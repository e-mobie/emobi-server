const Events = require('./Events-mongo.js');
function publicEvents(req, res, error) {
  // let events = new Events()
Events.findById(req.params.eventkey).then((response) => {
  if (response.eventType == 'public') {
    if (response.publisher == req.params.email) {
      if (response.status == 'published') {
        res.send(response)
      }
    }
  }
})

  // events.GetEvent(req.params.eventkey).then((response) => {
  //   // res.send(response)
  //   if (response.eventType == 'public') {
  //     if (response.publisher == req.params.email) {
  //       if (response.status == 'published') {
  //         res.send(response)
  //       }
  //     }
  //   }
  // })
  // res.send(req.params)
}

module.exports = publicEvents
