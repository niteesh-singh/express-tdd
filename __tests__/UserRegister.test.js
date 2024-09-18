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
    expect(Object.keys(body.validationErrors)).toEqual(["username", "email"]);
  });

  it.each([
    ["username", "Username cannot be null"],
    ["email", "E-Mail cannot be null"],
    ["password", "Password cannot be null"],
  ])("when %s field is null %s is received", async (field, expectedMessage) => {
    const user = {
      username: "user1",
      email: "user1@mail.com",
      password: "password1",
    };
    user[field] = null;
    const response = await postUser(user);
    const body = response.body;
    expect(body.validationErrors[field]).toBe(expectedMessage);
  });

  // it("returns Username cannot be null when username is null", async () => {
  //   const response = await postUser({
  //     username: null,
  //     email: "user1@mail.com",
  //     password: "password1",
  //   });

  //   const body = response.body;
  //   expect(body.validationErrors.username).toBe("Username cannot be null");
  // });

  // it("returns E-Mail cannot be null when email is null", async () => {
  //   const response = await postUser({
  //     username: "user1",
  //     email: null,
  //     password: "password1",
  //   });

  //   const body = response.body;
  //   expect(body.validationErrors.email).toBe("E-Mail cannot be null");
  // });

  // it("returns Password cannot be null when password is null", async () => {
  //   const response = await postUser({
  //     username: "user1",
  //     email: "user1@mail.com",
  //     password: null,
  //   });

  //   const body = response.body;
  //   expect(body.validationErrors.password).toBe("Password cannot be null");
  // });
});
