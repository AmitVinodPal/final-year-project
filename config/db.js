// db.js
const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        await mongoose.connect("mongodb://127.0.0.1:27017/gurukul"); // your database name
        console.log("MongoDB Connected ");
    } catch (err) {
        console.error("MongoDB Connection Error ❌", err);
        process.exit(1); // exit process if DB connection fails
    }
};

module.exports = connectDB;
