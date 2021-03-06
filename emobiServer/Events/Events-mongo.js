const mongoose = require('mongoose');

let EventsSchema = mongoose.Schema({
  title: String,
  tickets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tickets'}],
  eventType: String,
  description: String,
finishTime: String,
location: String,
  // finishTime: Date,
  status: {type: String, default: 'unpublished'},
  publisher: String,
  flyer: String,
  flyer_thumbnail: String,
  // flyer: mongoose.Schema.Types.ObjectId,
  category: String,
  Tags: Array,
  startTime: String,
  // startTime: Date
  soft_delete: {type: Boolean, default: false}

})

let Events = mongoose.model('Events', EventsSchema)

module.exports = Events
