// Импорт необходимых модулей
const mongoose = require('mongoose');
require('dotenv').config();

// Функция для подключения к базе данных MongoDB Atlas
const connectDB = async () => {
  try {
    // Подключение к базе данных с использованием строки подключения из .env
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB подключена: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Ошибка подключения к MongoDB: ${error.message}`);
    process.exit(1); // Выход с ошибкой
  }
};

module.exports = connectDB;