const mongoose = require('mongoose')
require('dotenv').config({ path: '.env.local' })

const conectarDB = async () => {
  try {
    await mongoose.connect(process.env.DB_MONGO, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
      useCreateIndex: true
    })
    console.log('DB conectada')
  } catch (error) {
    console.log('Error conexión')
    console.log(Error)
    console.exception(1)
  }
}

module.exports = conectarDB
