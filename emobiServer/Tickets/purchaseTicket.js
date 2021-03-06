const Tickets = require('./tickets-mongo.js');
const PurchaseOrder = require('../PurchaseOrders').Model;
const ioredis = require('ioredis');
const dot = require('dot');
const fs = require('fs');
const path = require('path');
const mailgun = require('mailgun-js');
const awesomeQR = require('awesome-qr');


function sendEmailConfirmation(invoiceObj, callback) {
  // get email file
  fs.readFile(path.join(__dirname, '..', 'Emails', 'Templates', 'transaction.html'), 'utf8', function (error, data) {
    if (error == null) {
      let rawEmail = data;
      // console.log(invoiceObj);
      let templateFunction = dot.template(rawEmail)
      let parsedEmail = templateFunction(invoiceObj)
      let qrCode = ''
      let qrURL = "?eventId=" + invoiceObj.eventId._id + "&invoiceId=" + invoiceObj._id + "&isPurchaser=true"
      new awesomeQR().create({
        text: qrURL,
        size: 350,
        callback: (data) => {
          qrCode = data
        }
      })
      // load mailgun
      let api_key = process.env.MAILGUN_API_KEY;
      let DOMAIN = process.env.MAILGUN_API_DOMAIN;
      let mailgun = require('mailgun-js')({
        apiKey: api_key,
        domain: DOMAIN
      })
      let attach = new mailgun.Attachment({data: qrCode, filename: 'qrCode.png', contentType: 'image/png'})

      let emailMeta = {
        from: 'E-MOBiE Support<support@e-mobie.com>',
        to: invoiceObj.purchaser,
        subject: 'Your recent E-Mobie Purchase',
        html: parsedEmail,
        inline: attach
      }

      //fire mail gun
      mailgun.messages().send(emailMeta, function (error, body) {
        callback(error, body)
      })
    } else {
      callback(error, 'there was an error')
    }
  })
}

function sendEmailInvite(rsvp, invoiceObj, callback) {
  // get email file
  fs.readFile(path.join(__dirname, '..', 'Emails', 'Templates', 'transaction.html'), 'utf8', function (error, data) {
    if (error == null) {
      let rawEmail = data;
      console.log('Invite Email part');
      let templateFunction = dot.template(rawEmail)
      let parsedEmail = templateFunction(invoiceObj)
      let qrCode = ''
      let qrURL = "?eventId=" + invoiceObj.eventId._id + "&invoiceId=" + invoiceObj._id + "&isPurchaser=false&rsvp=" + rsvp.email
      new awesomeQR().create({
        text: qrURL,
        size: 300,
        callback: (data) => {
          qrCode = data
        }
      })
      // load mailgun
      let api_key = process.env.MAILGUN_API_KEY;
      let DOMAIN = process.env.MAILGUN_API_DOMAIN;
      let mailgun = require('mailgun-js')({
        apiKey: api_key,
        domain: DOMAIN
      })
      let attach = new mailgun.Attachment({data: qrCode, filename: 'qrCode.png', contentType: 'image/png'})

      let emailMeta = {
        from: 'E-MOBiE Pass<sales@e-mobie.com>',
        to: rsvp.email,
        subject: 'E-Mobie Pass',
        html: parsedEmail,
        inline: attach
      }

      //fire mail gun
      mailgun.messages().send(emailMeta, function (error, body) {
        console.log(body);
        callback(error, body)
      })
    } else {
      callback(error, 'there was an error')
    }
  })
}

function processPurchase(req, res, error) {
  Tickets.findById(req.body.ticket._id).then((foundTicket) => {
    if (foundTicket.eventId == req.body.eventId) {
      //inspect customer request
      let ticket_cost = 0
      if (foundTicket.price != null) {
        ticket_cost = foundTicket.price
      }
      let total_passes = req.body.guestList.length
      let guest_passes = req.body.guestList.filter(obj => obj.guest_spot == true)
      guest_passes.forEach((pass) => {
        pass.outstanding = true
      })

      let rsvp = req.body.guestList.filter(obj => obj.guest_spot == false)
      rsvp.forEach((pass) => {
        pass.outstanding = true
      })

      if ((foundTicket.quantity_available - total_passes) >= 0) {
        let tempQtyAvail = foundTicket.quantity_available
        let tempQtySold = foundTicket.qty_sold
        //
        foundTicket.quantity_available = tempQtyAvail - total_passes
        foundTicket.qty_sold = tempQtySold + total_passes

        foundTicket.save().then((updatedTickect) => {

          // create the invoice
          PurchaseOrder.create({
            purchaser: req.user.email,
            eventId: updatedTickect.eventId,
            cost: (ticket_cost * total_passes),
            contents: req.body.guestList,
            invoice_life: total_passes,
            rsvp_list: rsvp,
            ticketId: req.body.ticket._id,
            guest_passes: guest_passes
          }).then((response) => {
            PurchaseOrder.findById(response._id).populate('eventId').populate('ticketId').exec((err, results) => {
              if (err == null) {
                sendEmailConfirmation(results, function (error, body) {
                  console.log(body);
                  // IDEA: Do some meta data logging here.
                  // IDEA: Change this function to a promise.
                })
                results.rsvp_list.forEach((rsvp) => {
                  if (rsvp.email != results.purchaser) {
                    sendEmailInvite(rsvp, results, function (error, body) {
                      console.log(body);
                        // IDEA: Do some meta data logging here.
                        // IDEA: Change this function to a promise.
                    })
                  }
                })
              }
            })

            PurchaseOrder.findById(response._id).populate('eventId').populate('ticketId').then((response) => {
              //notify app of sale
              let redis = new ioredis
              redis.publish('customerNotifications', JSON.stringify({
                from: "server",
                to: "all",
                message: "Ticket Sale",
                sale: {
                  eventId: response.eventId._id,
                  ticketId: response.ticketId._id,
                  qty: response.invoice_life
                }
              }))
              //send data back to customer to update their state
              res.send({
                success: true,
                data: response
              })
            })
          })

        })

      } else {
        res.send({
          success: false,
          message: 'Tickets not available'
        })
      }
    } else {
      res.sendStatus(500)
    }
  })
  //create purchase order based on info provided
}
module.exports = processPurchase
