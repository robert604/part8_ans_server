const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  value: {
    type: String
  }
})

module.exports = mongoose.model('Token',schema)