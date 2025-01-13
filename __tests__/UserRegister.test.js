const request = require("supertest");
const app = require("../src/app");
const User = require("../src/user/User");
const sequelize = require("../src/config/database");
const EmailService = require("../src/email/EmailService");
const { SMTPServer } = require("smtp-server");

beforeAll(() => {
  return sequelize.sync();
});

beforeEach(() => {
  return User.destroy({ truncate: true });
});

const validUser = {
  username: "user1",
  email: "user1@mail.com",
  password: "password1",
};

const postUser = (user = validUser, options = {}) => {
  const agent = request(app).post("/api/1.0/users");
  if (options.language) {
    agent.set("Accept-Language", options.language);
  }
  return agent.send(user);
};

describe("User registration", () => {
  it("returns 200 ok when signup request is valid", async () => {
    const response = await postUser();
    expect(response.status).toBe(200);
  });

  it("returns success message when signup request is valid", async () => {
    const response = await postUser();
    expect(response.body.message).toBe("User created");
  });

  it("saves the user to database", async () => {
    await postUser();
    const userList = await User.findAll();
    expect(userList.length).toBe(1);
  });

  it("saves the username and email to database", async () => {
    await postUser();
    const userList = await User.findAll();
    expect(userList.length).toBe(1);
  });

  it("hashes the password in database", async () => {
    await postUser();
    const userList = await User.findAll();
    const savedUser = userList[0];
    expect(savedUser.password).not.toBe("password1");
  });

  it("returns 400 when username is null", async () => {
    const response = await postUser({
      username: null,
      email: "user1@mail.com",
      password: "password1",
    });

    expect(response.status).toBe(400);
  });

  it("returns validationErrors field in response body when validation error occurs", async () => {
    const response = await postUser({
      username: null,
      email: "user1@mail.com",
      password: "password1",
    });

    const body = response.body;
    expect(body.validationErrors).not.toBeUndefined();
  });

  it("returns for both when username and email is null", async () => {
    const response = await postUser({
      username: null,
      email: null,
      password: "password1",
    });

    const body = response.body;
    expect(Object.keys(body.validationErrors)).toEqual(["username", "email"]);
  });

  const username_null = "Username cannot be null";
  const username_size = "Must have min 4 and max 32 characters";
  const email_null = "E-Mail cannot be null";
  const email_not_valid = "E-Mail is not valid";
  const password_null = "Password cannot be null";
  const password_size = "Password must be at least 6 characters";
  const password_pattern =
    "Password must have at least 1 uppercase letter, 1 lowercase letter, and 1 number";
  it.each`
    field         | value              | expectedMessage
    ${"username"} | ${null}            | ${username_null}
    ${"username"} | ${"usr"}           | ${username_size}
    ${"username"} | ${"a".repeat(33)}  | ${username_size}
    ${"email"}    | ${null}            | ${email_null}
    ${"email"}    | ${"mail.com"}      | ${email_not_valid}
    ${"email"}    | ${"user.mail.com"} | ${email_not_valid}
    ${"email"}    | ${"user@mail"}     | ${email_not_valid}
    ${"password"} | ${null}            | ${password_null}
    ${"password"} | ${"passw"}         | ${password_size}
    ${"password"} | ${"alllowercase"}  | ${password_pattern}
    ${"password"} | ${"ALLUPPERCASE"}  | ${password_pattern}
    ${"password"} | ${"1234567890"}    | ${password_pattern}
  `(
    "returns $expectedMessage when $field is ${value}",
    async ({ field, expectedMessage, value }) => {
      const user = {
        username: "user1",
        email: "user1@mail.com",
        password: "password1",
      };
      user[field] = value;
      const response = await postUser(user);
      const body = response.body;
      expect(body.validationErrors[field]).toBe(expectedMessage);
    }
  );

  it("returns E-Mai in use when same email is aleady in use", async () => {
    await User.create({ ...validUser });
    const response = await postUser();
    expect(response.body.validationErrors.email).toBe("E-Mail in use");
  });

  it("returns errors for both username is null and email is in use", async () => {
    await User.create({ ...validUser });
    const response = await postUser({
      username: null,
      email: validUser.email,
      password: "password1",
    });
    const body = response.body;
    expect(Object.keys(body.validationErrors)).toEqual(["username", "email"]);
  });

  it("creates user in inactive mode", async () => {
    await postUser();
    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.inactive).toBe(true);
  });

  it("creates user in inactive mode even the req body contains inactive as false", async () => {
    const newUser = { ...validUser, inactive: false };
    await postUser(newUser);
    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.inactive).toBe(true);
  });

  it("creates an activation token for user", async () => {
    await postUser();
    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.activationToken).toBeTruthy();
  });

  it.only("send and Account Activation email with activationToken", async () => {
    let lastMail;
    const server = new SMTPServer({
      authOptional: true,
      onData(stream, session, callback) {
        let mailBody = "";
        stream.on("data", (data) => {
          console.log("Data chunk received:", data.toString());
          mailBody += data.toString();
        });
        stream.on("end", () => {
          console.log("Mail Body:", mailBody);
          lastMail = mailBody;
          callback();
        });
      },
    });
    await server.listen(8587, "localhost");
    await postUser();
    await server.close();
    const users = await User.findAll();
    const savedUser = users[0];
    console.log("lastmail>>", lastMail);
    expect(lastMail).toContain("user1@mail.com");
    expect(lastMail).toContain(savedUser.activationToken);
  });
  it("return 502 bad gateway when sending email fails", async () => {
    const mockSendAccountActivation = jest
      .spyOn(EmailService, "sendAccountActivation")
      .mockRejectedValue({ message: "Failed to deliver email" });
    const response = await postUser();
    expect(response.status).toBe(502);
    mockSendAccountActivation.mockRestore();
  });

  it("return Email failure message when sending email fails", async () => {
    const mockSendAccountActivation = jest
      .spyOn(EmailService, "sendAccountActivation")
      .mockRejectedValue({ message: "Failed to deliver email" });
    const response = await postUser();
    mockSendAccountActivation.mockRestore();
    expect(response.body.message).toBe("E-Mail failure");
  });

  it("does not save user to database if activation email fails", async () => {
    const mockSendAccountActivation = jest
      .spyOn(EmailService, "sendAccountActivation")
      .mockRejectedValue({ message: "Failed to deliver email" });
    const response = await postUser();
    mockSendAccountActivation.mockRestore();
    const users = await User.findAll();
    expect(users.length).toBe(0);
  });
});

describe("Internationalization", () => {
  const username_null = "उपयोगकर्ता नाम शून्य नहीं हो सकता";
  const username_size = "न्यूनतम 4 और अधिकतम 32 अक्षर होने चाहिए";
  const email_null = "ई-मेल शून्य नहीं हो सकता";
  const email_not_valid = "विद्युतडाक मान्य नहीं है";
  const password_null = "पासवर्ड शून्य नहीं हो सकता";
  const password_size = "पासवर्ड कम से कम 6 अंकों का होना चाहिए";
  const password_pattern =
    "पासवर्ड में कम से कम 1 बड़ा अक्षर, 1 छोटा अक्षर और 1 संख्या होनी चाहिए";
  it.each`
    field         | value              | expectedMessage
    ${"username"} | ${null}            | ${username_null}
    ${"username"} | ${"usr"}           | ${username_size}
    ${"username"} | ${"a".repeat(33)}  | ${username_size}
    ${"email"}    | ${null}            | ${email_null}
    ${"email"}    | ${"mail.com"}      | ${email_not_valid}
    ${"email"}    | ${"user.mail.com"} | ${email_not_valid}
    ${"email"}    | ${"user@mail"}     | ${email_not_valid}
    ${"password"} | ${null}            | ${password_null}
    ${"password"} | ${"passw"}         | ${password_size}
    ${"password"} | ${"alllowercase"}  | ${password_pattern}
    ${"password"} | ${"ALLUPPERCASE"}  | ${password_pattern}
    ${"password"} | ${"1234567890"}    | ${password_pattern}
  `(
    "returns $expectedMessage when $field is ${value} and when language is set to Hindi",
    async ({ field, expectedMessage, value }) => {
      const user = {
        username: "user1",
        email: "user1@mail.com",
        password: "password1",
      };
      user[field] = value;
      const response = await postUser(user, { language: "hi" });
      const body = response.body;
      expect(body.validationErrors[field]).toBe(expectedMessage);
    }
  );

  it("returns E-Mai in use when same email is aleady in use", async () => {
    await User.create({ ...validUser });
    const response = await postUser({ ...validUser }, { language: "hi" });
    expect(response.body.validationErrors.email).toBe("E-Mail in use");
  });
});
