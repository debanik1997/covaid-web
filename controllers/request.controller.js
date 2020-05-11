const Requests = require('../models/request.model');
const Users = require('../models/user.model');
const Association = require('../models/association.model');
const asyncWrapper = require('../util/asyncWrapper');
const distance_tools = require('../util/distance_tools');
const Pusher = require('pusher');
const emailer = require('../util/emailer')
require('dotenv').config();

const RequestService = require('../services/request.service');

const pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_APP_KEY,
    secret: process.env.PUSHER_APP_SECRET,
    cluster: process.env.PUSHER_APP_CLUSTER,
    useTLS: true
});

/**
 * Handle requests to get all requests under an association
 */
exports.getAllRequestsOfAnAssoc = asyncWrapper(async (req, res) => {
    const assoc = req.query.association;
    const query = {
        "association":  assoc,
        '$or': [{'delete': false}, {'delete': {"$exists": false}}]
    }
    var requests = await RequestService.getRequests(query);
    res.send(requests);
});

/**
 * Handle requests to get all requests tied to a user
 */
exports.handleGetVolunteerRequests = asyncWrapper(async (req, res) => {
    const query = {
        "status.volunteers.volunteer":  req.token.id,
        "status.volunteers.current_status": req.query.status
    }
    try {
        var requests = await RequestService.getRequests(query);
        res.send(requests);
    } catch (e) {
        res.sendStatus(400);
    }
});

/**
 * Handle requests to create a request
 */
exports.createARequest = asyncWrapper(async (req, res) => {
    const { body: { request } } = req;
    try {
		const new_request = await RequestService.createRequest(request);
        return (new_request._id === null) ? res.sendStatus(500) : res.status(201).send({'_id': new_request._id});
    } catch (e) {
		return res.status(422).send(e);
    }
});

/**
 * Handle requests to match volunteers to a request
 */
exports.matchVolunteers = asyncWrapper(async (req, res) => {
    const { body: { volunteers, _id, adminMessage } } = req;
    try {
        let updated_request = await RequestService.matchVolunteers(_id, volunteers, adminMessage);
        return res.status(200).send(updated_request);
    } catch (e) {
        console.log(e)
        res.status(400).send(e);
    }
});

/**
 * Handle requests to unmatch volunteers from a request
 */
exports.unmatchVolunteers = asyncWrapper(async (req, res) => {
    const { body: { volunteers, _id, adminMessage } } = req;
    try {
        let updated_request = await RequestService.unmatchVolunteers(_id, volunteers, adminMessage);
        return res.status(200).send(updated_request);
    } catch (e) {
        console.log(e)
        res.status(400).send(e);
    }
});

/**
 * Handle requests to accept a request as a volunteer
 */
exports.acceptRequest = asyncWrapper(async (req, res) => {
    const req_id = req.query.ID
    var request = await Requests.findByIdAndUpdate(req_id, 
        {
            $set: {
                volunteer_status: 'accepted',
                'pending_time': new Date()
            }
        })
    if (request) {

        var assoc = await Association.findOne({
            '_id': request.association
        });

        for (var i = 0; i < assoc.admins.length; i++) {
            var admin = assoc.admins[i];
            if (admin.name === request.assignee) {
                console.log(admin.email)
                var data = {
                    //sender's and receiver's email
                    sender: "Covaid@covaid.co",
                    receiver: admin.email,
                    name: request.requester_first,
                    action: 'accepted',
                    templateName: "admin_notification",
                };
                emailer.sendNotificationEmail(data)
                break;
            }
        }
        res.sendStatus(200)
        return
    } else {
        res.sendStatus(404)
        return
    }
});

/**
 * Handle requests to attach a volunteer to a request
 */
exports.attachVolunteer = asyncWrapper(async (req, res) => {
    const request_id = req.body.request_id
    const volunteer_id = req.body.volunteer_id
    const volunteer_email = req.body.volunteer_email
    const volunteer_name = req.body.volunteer_name
    const adminMessage = req.body.adminDetails
    Requests.findByIdAndUpdate(request_id, 
        {$set: {
            "status": {
                "current_status": "in_progress",
                "volunteer": volunteer_id
            }, 
            "volunteer_status": 'pending',
            "adminMessage": adminMessage,
            "pending_time": new Date(),
            "last_modified": new Date()
        }
    }, function (err, request) {
        if (err) return next(err);
        if (request.association){
            Association.findById(request.association, function (err, assoc) {
                if (err) res.sendStatus(403)
                var associationEmail = assoc.email;
                var data = {
                    //sender's and receiver's email
                    sender: "Covaid@covaid.co",
                    receiver: volunteer_email,
                    name: volunteer_name,
                    assoc: associationEmail,
                    templateName: "volunteer_notification",
                };
                emailer.sendNotificationEmail(data)
                pusher.trigger(req.body.volunteer_id, 'direct-match', request_id)
                }
            )
        }
        res.send('Request updated.');
    });
});

/**
 * Handle requests to remove a volunteer from a request
 */
exports.removeVolunteer = asyncWrapper(async (req, res) => {
    const request_id = req.body.request_id;
    const assoc_id = req.body.assoc_id;
    const volunteer_id = req.body.volunteer_id;
    var updateQuery = {'$set': {
        "status": {
            "current_status": "incomplete",
            "volunteer": ""
        },
        "adminMessage": "",
        "volunteer_status": "",
        "last_modified": new Date()}}

    if (volunteer_id) {
        updateQuery['$push'] = {'prev_matched': volunteer_id};
    }

    Requests.findByIdAndUpdate(request_id, updateQuery, function (err, request) {
        if (err) return next(err);
        Association.findOne({
            '_id': request.association
        }, function (err, assoc) {
            if (err) return next(err)
            var foundAdmin = false
            for (var i = 0; i < assoc.admins.length; i++) {
                var admin = assoc.admins[i];
                if (admin.name === request.assignee) {
                    var data = {
                        //sender's and receiver's email
                        sender: "Covaid@covaid.co",
                        receiver: admin.email,
                        name: request.requester_first,
                        action: 'rejected',
                        templateName: "admin_notification",
                    };
                    emailer.sendNotificationEmail(data)
                    foundAdmin = true
                    break;
                }
            }
            if (!foundAdmin) {
                var data = {
                    //sender's and receiver's email
                    sender: "Covaid@covaid.co",
                    receiver: assoc.email,
                    name: request.requester_first,
                    assoc: assoc.name,
                    templateName: "org_notification",
                 };
        
                emailer.sendNotificationEmail(data)
            }
        });
        pusher.trigger(assoc_id, 'general', 'A volunteer has been unmatched from a request!')
        res.send('Request updated.');
    });
});

/**
 * Handle requests to complete a request
 */
exports.completeARequest = asyncWrapper(async (req, res) => {
    const request_id = req.body.request_id;
    const reason = req.body.reason;
    Requests.findByIdAndUpdate(request_id, 
        {$set: {
            "status.current_status": "complete",
            "status.reason": reason,
            "volunteer_status": "completed",
            "volunteer_comment": req.body.volunteer_comment,
            "last_modified": new Date(),
            "completed_date": new Date()
        }
    }, function (err, request) {
        if (err) return next(err);
        pusher.trigger(req.body.assoc_id, 'complete', request_id)
        res.send('Request updated.');
    });
});

/**
 * Handle requests to set a request assignee
 */
exports.setAssignee = asyncWrapper(async (req, res) => {
    const request_id = req.body.request_id;
    const assignee = req.body.assignee;
    Requests.findByIdAndUpdate(request_id, 
        {$set: {
            "assignee": assignee,
            "last_modified": new Date()
        }
    }, function (err, request) {
        if (err) return next(err);
        res.send('Request updated.');
    });
});

/**
 * Handle requests to set the notes of a request
 */
exports.setNotes = asyncWrapper(async (req, res) => {
    const request_id = req.body.request_id;
    const note = req.body.note;
    Requests.findByIdAndUpdate(request_id, 
        {$set: {
            "note": note,
            "last_modified": new Date()
        }
    }, function (err, request) {
        if (err) return next(err);
        res.send('Request updated.');
    });
});

/**
 * Handle requests to set a request to delete
 */
exports.setDelete = asyncWrapper(async (req, res) => {
    const request_id = req.body.request_id;
    Requests.findByIdAndUpdate(request_id, 
        {$set: {
            "delete": true,
            "last_modified": new Date()
        }
    }, function (err, request) {
        if (err) return next(err);
        res.send('Request updated.');
    });
});

/**
 * Handle requests to set a manual volunteer to a request
 */
exports.setManualVolunteer = asyncWrapper(async (req, res) => {
    const request_id = req.body.request_id;
    Requests.findByIdAndUpdate(request_id, 
        {$set: {
            "last_modified": new Date(),
            'manual_match': {
                "name": req.body.name,
                "email": req.body.email,
                "phone": req.body.phone,
                "details": req.body.details
            },
            "status": {
                "current_status": "in_progress",
                "volunteer": "manual"
            }
        }
    }, function (err, request) {
        if (err) return next(err);
        res.send('Request updated.');
    });
});