const express = require("express");
const app = express();
const i18next = require("i18next");
const Backend = require("i18next-fs-backend");
const middleware = require("i18next-http-middleware");
const UserRouter = require("./user/UserRouter");

i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    fallbackLng: "en",
    lng: "en",
    ns: ["translation"],
    defaultNS: "translation",
    backend: {
      loadPath: "./locales/{{lng}}/{{ns}}.json",
    },
    detection: {
      lookupHeader: "accept-language",
    },
  });

app.use(middleware.handle(i18next));

app.use(express.json());
app.use(UserRouter);

module.exports = app;
