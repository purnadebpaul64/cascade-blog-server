require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 3000;

// middlewares
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("welcome to the CascadeBlog server.......");
});

app.listen(port, () => {
  console.log("server is running");
});
