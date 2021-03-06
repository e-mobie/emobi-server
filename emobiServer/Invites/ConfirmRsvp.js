const Invite = require('./invite.js');
const Tickets = require('../Tickets').Class;
const Invoice = require('../PurchaseOrders').Model;
const dot = require('dot');
const fs = require('fs');
const path = require('path');
const mailgun = require('mailgun-js');
const awesomeQR = require('awesome-qr');


function sendEmailInvite(rsvp, invoiceObj, callback) {
  // get email file
  fs.readFile(path.join(__dirname, '..', 'Emails', 'Templates', 'transaction.html'), 'utf8', function (error, data) {
    if (error == null) {
      let rawEmail = data;
      console.log('Invite Email part');
      let templateFunction = dot.template(rawEmail)
      let parsedEmail = templateFunction(invoiceObj)
      let qrCode = ''
      let qrURL = "?eventId=" + invoiceObj.eventId._id + "&invoiceId=" + invoiceObj._id + "&isPurchaser=true&rsvp=" + rsvp.email
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

function ConfirmRsvp(req, res, error) {
  // Find invite
Invite.findById(req.params.invite_id).then((results) => {
  if (results.email === req.body.confirmed_email) {
    Invite.findByIdAndUpdate(req.params.invite_id, {status: 'Confirmed'}, (error, updated_results) => {
      // res.send(updated_results)
      // Create E-Pass
      let rsvp = []
      let rsvp_layout = {
        name: updated_results.name,
        email: updated_results.email,
        dob: null,
        phone: null,
        guest_spot: false,
        signed_in: false,
      }
      rsvp.push(rsvp_layout)

      Tickets.findById(updated_results.ticketId).then((foundTicket) => {
        let ticket_cost = 0
        if (foundTicket.price != null) {
          ticket_cost = foundTicket.price
        }
        Invoice.create({
          purchaser: req.body.confirmed_email,
          eventId: foundTicket.eventId,
          cost: (ticket_cost * 1),
          contents: rsvp,
          invoice_life: 1,
          rsvp_list: rsvp,
          ticketId: foundTicket._id,
          guest_passes: []
        }).then((response) => {
          Invoice.findById(response._id).populate('eventId').populate('ticketId').exec((err, results) => {
            sendEmailInvite(rsvp_layout, results, function (error, body) {
              res.send({
                error,
                body
              })
            })
          })
        })
      })

    })
  }
})
}

module.exports = ConfirmRsvp
