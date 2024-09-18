const express = require("express");
const router = express.Router();
const { check, validationResult } = require("express-validator");
const UserService = require("./UserService");

router.post(
  "/api/1.0/users",
  check("username")
    .notEmpty()
    .withMessage("Username cannot be null")
    .bail()
    .isLength({ min: 4, max: 32 })
    .withMessage("Must have min 4 and max 32 characters"),
  check("email")
    .notEmpty()
    .withMessage("E-Mail cannot be null")
    .bail()
    .isEmail()
    .withMessage("E-Mail is not valid"),
  check("password")
    .notEmpty()
    .withMessage("Password cannot be null")
    .bail()
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters")
    .bail()
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/, "i")
    .withMessage(
      "Password must have at least 1 uppercase letter, 1 lowercase letter, and 1 number"
    ),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const validationErrors = {};
      errors
        .array()
        .forEach((error) => (validationErrors[error.path] = error.msg));
      return res.status(400).send({ validationErrors });
    }
    await UserService.save(req.body);
    return res.send({ message: "User created" });
  }
);

module.exports = router;
