const app = require("./src/app");
const sequilize = require("./src/config/database");

sequilize.sync({ force: true });

app.listen(3000, () => {
  console.log("app is running...");
});
