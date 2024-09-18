const request = require("supertest");
const app = require("../src/app");
const User = require("../src/user/User");
const sequelize = require("../src/config/database");

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

const postUser = (user = validUser) => {
  return request(app).post("/api/1.0/users").send(user);
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
    console.log("body>>", body);
    expect(Object.keys(body.validationErrors)).toEqual(["username", "email"]);
  });

  it.each`
    field         | value              | expectedMessage
    ${"username"} | ${null}            | ${"Username cannot be null"}
    ${"username"} | ${"usr"}           | ${"Must have min 4 and max 32 characters"}
    ${"username"} | ${"a".repeat(33)}  | ${"Must have min 4 and max 32 characters"}
    ${"email"}    | ${null}            | ${"E-Mail cannot be null"}
    ${"email"}    | ${"mail.com"}      | ${"E-Mail is not valid"}
    ${"email"}    | ${"user.mail.com"} | ${"E-Mail is not valid"}
    ${"email"}    | ${"user@mail"}     | ${"E-Mail is not valid"}
    ${"password"} | ${null}            | ${"Password cannot be null"}
    ${"password"} | ${"passw"}         | ${"Password must be at least 6 characters"}
    ${"password"} | ${"alllowercase"}  | ${"Password must have at least 1 uppercase letter, 1 lowercase letter, and 1 number"}
    ${"password"} | ${"ALLUPPERCASE"}  | ${"Password must have at least 1 uppercase letter, 1 lowercase letter, and 1 number"}
    ${"password"} | ${"1234567890"}    | ${"Password must have at least 1 uppercase letter, 1 lowercase letter, and 1 number"}
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
});
