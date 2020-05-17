const request_status = {
    UNMATCHED: 0,
    MATCHED: 1,
    COMPLETED: 2
}
    
const volunteer_status = {
    PENDING: 0,
    IN_PROGRESS: 1,
    COMPLETE: 2,
    REJECTED: 3,
    DOES_NOT_EXIST: -1
}

const RequestRepository = require('../repositories/request.repository');
const AssociationService = require('./association.service');
const UserService = require('./user.service');
const emailer = require('../util/emailer');
const Pusher = require('pusher');

const pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_APP_KEY,
    secret: process.env.PUSHER_APP_SECRET,
    cluster: process.env.PUSHER_APP_CLUSTER,
    useTLS: true
});

/**
 * Generic get requests given a query
 */ 
exports.getRequests = async function(query) {
    try {
        return await RequestRepository.readRequest(query);
    } catch (e) {
        throw e;
    }
}

/**
 * Get statistics for a volunteer given volunteer ID
 */
exports.getVolunteerStatistics = async function(id) {
    const query = {
        "status.volunteers.volunteer":  id
    }
    try { 
        var requests = await RequestRepository.readRequest(query);
        var statistics = {total: 0, completed: 0}; 
        statistics['total'] = requests.length; 
        requests.forEach(request => {
            request.status.volunteers.forEach(volunteer_obj => { 
                if (volunteer_obj.volunteer === id && volunteer_obj.current_status === volunteer_status.COMPLETE) {
                    statistics['completed'] = statistics['completed'] + 1; 
                }
            }); 
        });
        return statistics; 
    } catch (e) {
        throw e;
    }
}

/**
 * Get requests for a volunteer given a particuar request status
 */
exports.getVolunteerRequests = async function(id, status) {
    const query = {
        "status.volunteers.volunteer":  id
    }
    try {
        var requests = await RequestRepository.readRequest(query); // Find all requests that contain the volunteer
        var volunteer_requests = [];
        requests.forEach(request => {
            request.status.volunteers.forEach(volunteer_obj => {
                if (volunteer_obj.volunteer === id && volunteer_obj.current_status === parseInt(status)) { // Check that the volunteer status for the desired volunteer matches the requested status
                    if (request.status.current_status === request_status.COMPLETED) { // Special case -> if a request is complete, only send it back to the volunteers who completed it
                        if (volunteer_obj.current_status === volunteer_status.COMPLETE) {
                            volunteer_requests.push(request);
                        }
                    } else {
                        volunteer_requests.push(request); // Add the request to the list of requests for this volunteer/status combo
                    }
                }
            });
        });

        return volunteer_requests;

    } catch (e) {
        throw e;
    }
}

/**
 * Create a request (whether direct or general)
 */
exports.createRequest = async function(request) {
    try {
        let new_request = request.status.volunteer ? await handleDirectMatch(request) : await handleGeneral(request); // if there is a volunteer attached to the request, create direct match. Otherwise, create general
        new_request.time_posted = new Date();
        new_request['admin_info'] = {
            last_modified: new Date(),
            assignee: 'No one assigned'
        }
        console.log(new_request);

        // In progress
        // ***check*** if these scenarios are handled correctly 
        // Scenario: when a request is created [no volunteer in body] -> send email to the association (+ push notif) 
        var assoc = await AssociationService.getAssociation({'_id': request.association}); // ***check logic*** -> make sure it defaults to Covaid
        if (!new_request.volunteer) { 
            var data = {
                sender: 'Covaid@covaid.co',
                receiver: assoc.email,
                name: request.requester_first,
                assoc: assoc.name,
                templateName: 'org_notification',
            };
            emailer.sendNotificationEmail(data)
            pusher.trigger(request.association, 'general', "You have a new unmatched request!")
        } else { // Scenario: when a request is created [volunteer in body] -> send email to volunteer (+ push notif) 
            volunteers = [request.body.volunteer]

            request.body.volunteer.forEach(volunteer => { // ***check*** 
                var first_name = volunteer.first_name;
                first_name = first_name.toLowerCase();
                first_name = first_name[0].toUpperCase() + first_name.slice(1);
                var data = {
                    sender: "Covaid@covaid.co",
                    receiver: volunteer.email,
                    name: first_name,
                    assoc: assoc.email,
                    templateName: 'volunteer_notification',
                };
                emailer.sendNotificationEmail(data);
                pusher.trigger(volunteer._id, 'direct-match', 'You have a new pending request!'); 
            });             
        }

        return await RequestRepository.createRequest(new_request);
    } catch (e) {
        console.log(e);
        throw e;
    }
}

// Construct a direct match request
async function handleDirectMatch(request) {
    let volunteer_status_obj = {
        current_status: volunteer_status.PENDING,
        volunteer: request.status.volunteer._id,
        volunteer_response: "",
        adminMessage: "",
        last_notified_time: new Date()
    }
    let volunteer_statuses = [
        volunteer_status_obj
    ]
    var volunteer = request.status.volunteer;
    request['status'] = {
        current_status: request_status.MATCHED,
        volunteers: volunteer_statuses,
        completed_reason: "",
        volunteer_quota: 1
    }

    // Prepare email/pusher notifications
    var associationEmail = 'covaidco@gmail.com'
    if (request.association) {
        let association = await AssociationService.getAssociation({'_id': request.association});
        associationEmail = association.email;
    }
    var first_name = volunteer.first_name;
    first_name = first_name.toLowerCase();
    first_name = first_name[0].toUpperCase() + first_name.slice(1);
    var data = {
        sender: "Covaid@covaid.co",
        receiver: volunteer.email,
        name: first_name,
        assoc: associationEmail,
        templateName: "volunteer_notification",
    };
    emailer.sendNotificationEmail(data);
    pusher.trigger(volunteer._id, 'direct-match', 'You have a new pending request!');
    return request;
}

// Construct a general request
async function handleGeneral(request) {
    request['status'] = {
        current_status: request_status.UNMATCHED,
        volunteers: [],
        completed_reason: "",
        volunteer_quota: 1
    }

    // Prepare email/pusher notifications
    var associationEmail = 'covaidco@gmail.com';
    var associationName = 'Covaid';
    if (request.association) {
        let association = (await AssociationService.getAssociation({'_id': request.association}))[0];
        associationEmail = association.email;
        associationName = association.name;
    }
    var data = {
        sender: "Covaid@covaid.co",
        receiver: associationEmail,
        name: request.personal_info.requester_name,
        assoc: associationName,
        templateName: "org_notification",
    };
    emailer.sendNotificationEmail(data);
    pusher.trigger(request.association, 'general', "You have a new unmatched request!");

    return request;
}

/**
 * Match a list of volunteers to a request
 */
exports.matchVolunteers = async function(requestID, volunteers, adminMessage) {
    try {
        let request = (await RequestRepository.readRequest({_id: requestID}))[0]; // Find the relevant request
        let volunteer_copy = request.status.volunteers
        // Given volunteer list, change existing volunteers to pending if rematched, and add new volunteers as pending. 
        //remove duplicate new volunteers by creating a set
        let set_volunteers = new Set(volunteers);
        set_volunteers = Array.from(set_volunteers)
        let new_volunteers = set_volunteers.map(function (volunteer_id) {
            if (!request.status.volunteers || request.status.volunteers.length === 0 || request.status.volunteers.filter(volunteer => volunteer.volunteer === volunteer_id).length === 0) {
                return {
                    current_status: volunteer_status.PENDING,
                    volunteer: volunteer_id,
                    volunteer_response: "",
                    last_notified_time: new Date(),
                    adminMessage: adminMessage
                }
            } else if (request.status.volunteers.filter(volunteer => volunteer.volunteer === volunteer_id).length != 0){
                let volunteer = volunteer_copy.filter(volunteer => volunteer.volunteer === volunteer_id)[0]
                let index = volunteer_copy.indexOf(volunteer)
                volunteer.current_status = volunteer_status.PENDING
                volunteer.last_notified_time = new Date();
                //if a new adminMessage is not given, keep the old message
                if (adminMessage.length > 0) {
                    volunteer.adminMessage = adminMessage
                } 
                volunteer_copy[index] = volunteer
            }
        });

        // Remove nulls
        new_volunteers = new_volunteers.filter(function(volunteer) { 
            if (volunteer) return volunteer
        });

        //append new and old volunteers together     
        let new_volunteers_list = [...volunteer_copy, ...new_volunteers]
        if (new_volunteers_list.length > 0) {
            await RequestRepository.updateRequest(requestID, { 
                $set: {
                    'status.volunteers': new_volunteers_list,
                    'admin_info.last_modified': new Date()
                }
            });
        }

        // Update request status to be matched if there are volunteers attached to it
        let updatedRequest = (await RequestRepository.readRequest({_id: requestID}))[0];
        var matchedVolunteers = 0;
        updatedRequest.status.volunteers.forEach(volunteer => {
            if (volunteer.current_status === volunteer_status.IN_PROGRESS || volunteer.current_status === volunteer_status.PENDING) {
                matchedVolunteers += 1;
            }
        });
        if (matchedVolunteers > 0) {
            await RequestRepository.updateRequest(requestID, {
                $set: {
                    'status.current_status': request_status.MATCHED
                }
            });
            updatedRequest = (await RequestRepository.readRequest({_id: requestID}))[0];
        }
        
        // TODO -> send emails
        // In progress
        // Scenario: when a volunteer is matched to a request -> send email to the volunteer (+ push notification) 
        var assoc = await AssociationService.getAssociation({'_id': updatedRequest.association}); // ***check logic*** -> make sure it defaults to Covaid

        let new_volunteer_ids = new_volunteers_list.forEach(volunteer => {
            return volunteer._id; 
        }); 

        new_volunteer_obj_list = await UserService.getUsersByUserIDs(new_volunteer_ids);
        for (var i = 0; i < new_volunteer_obj_list.length; i++) { 
            var curr_volunteer = new_volunteer_obj_list[i]; 
            var firstName = curr_volunteer.first_name;
            firstName = firstName.toLowerCase();
            firstName = firstName[0].toUpperCase() + firstName.slice(1);
            var data = { // ***check*** should adminMessage be used here? 
                sender: 'Covaid@covaid.co',
                receiver: curr_volunteer.email,
                name: firstName,
                assoc: assoc.email,
                templateName: 'volunteer_notification',
            };
            emailer.sendNotificationEmail(data); 
            pusher.trigger(curr_volunteer._id, 'direct-match', updatedRequest._id);
        }

        return updatedRequest;
    } catch (e) {
        throw e;
    }
}

/**
 * Unmatch all attached volunteers from a list
 */
exports.unmatchVolunteers = async function(requestID, volunteers) {
    try {
        let request = (await RequestRepository.readRequest({_id: requestID}))[0]; // Find the relevant request
        // if volunteers is not defined, unmatch all volunteers
        let removing_volunteers = !volunteers ? request.status.volunteers.map(function (volunteer) {return volunteer.volunteer}) :
         volunteers.map(function (volunteer_id) {
            if (request.status.volunteers.filter(volunteer => volunteer.volunteer === volunteer_id && volunteer.current_status !== volunteer_status.REJECTED).length !== 0) { // Get all attached volunteers from the volunteers list who have not already rejected the request
                return volunteer_id
            }
        });

        // Null check
        removing_volunteers = removing_volunteers.filter(function(volunteer) { 
            if (volunteer) return volunteer
        });

        // If there are volunteers that need to be removed
        if (removing_volunteers.length > 0) {
            var current_request = (await RequestRepository.readRequest({_id: requestID}))[0];
            current_request.admin_info.last_modified = new Date();
            current_request.status.volunteers.forEach(function(v, index, array) {
                if (removing_volunteers.filter(volunteer_id => volunteer_id === v.volunteer).length !== 0) {
                    // update the volunteer status for volunteers that are being unmatched from the request
                    array[index] = {
                        current_status: volunteer_status.REJECTED,
                        volunteer: v.volunteer,
                        last_notified_time: new Date(),
                        adminMessage: v.adminMessage
                    }
                }
            });
            await RequestRepository.updateRequest(requestID, current_request);
        }

        // If there are no more matched volunteers, request becomes unmatched
        let updatedRequest = (await RequestRepository.readRequest({_id: requestID}))[0];
        var matchedVolunteers = 0;
        updatedRequest.status.volunteers.forEach(volunteer => {
            if (volunteer.current_status === volunteer_status.IN_PROGRESS || volunteer.current_status === volunteer_status.PENDING) {
                matchedVolunteers += 1;
            }
        });
        if (matchedVolunteers === 0) {
            await RequestRepository.updateRequest(requestID, {
                $set: {
                    'status.current_status': request_status.UNMATCHED
                }
            });
            updatedRequest = (await RequestRepository.readRequest({_id: requestID}))[0];
        }

        // TODO -> send emails
        // In progress
        // Scenario: if a volunteer is unmatched from something, the organization has to be notified (+push notification)
        // don't worry abt sending emails to unmatched volunteers
        var assoc = await AssociationService.getAssociation({'_id': updatedRequest.association}); // ***check logic*** -> make sure it defaults to Covaid

        // Find admin
        // If admin exists, send them an email 
        var foundAdmin = false; 
        for (var i = 0; i < assoc.admins.length; i++) { 
            var admin = assoc.admins[i];
            if (admin.name === updatedRequest.assignee) {
                var data = {
                    sender: 'Covaid@covaid.co',
                    receiver: admin.email,
                    name: updatedRequest.requester_first,
                    action: 'accepted',
                    templateName: 'admin_notification',
                };
                emailer.sendNotificationEmail(data);
                foundAdmin = true; 
                break;
            }
        }

        // If no admin assigned to request, send email to association
        if (!foundAdmin) {
            var data = {
                sender: 'Covaid@covaid.co',
                receiver: assoc.email,
                name: updatedRequest.requester_first,
                action: 'accepted',
                templateName: 'org_notification',
            };
            emailer.sendNotificationEmail(data)
        }
        pusher.trigger(assoc._id, 'general', 'A volunteer has been unmatched from a request!'); 

        return updatedRequest;
    } catch (e) {
        throw e;
    }
}

/**
 * Volunteer accepting a request
 */
exports.acceptRequest = async function(volunteerID, requestID) {
    try {
        // Update a particular volunteer's volunteer-request-status to in_progress
        await RequestRepository.updateRequestComplex({'_id': requestID, 'status.volunteers.volunteer': volunteerID}, { 
            $set: {
                "status.volunteers.$.current_status": volunteer_status.IN_PROGRESS,
                "status.volunteers.$.last_notified_time": new Date()
            }
        });
        let updatedRequest = (await RequestRepository.readRequest({_id: requestID}))[0];

        // TODO -> Notify admins 
        // In progress
        // Scenario: when a volunteer accepts a request -> send email to admin 
        notifyRequestStatusChange(updatedRequest, 'accepted'); 
        // No push notification 
        
        return updatedRequest;
    } catch (e) {
        throw e;
    }
}

/**
 * Volunteer rejecting a request
 */
exports.rejectRequest = async function(volunteerID, requestID) {
    try {
        // Unmatch the volunteer from the request
        await exports.unmatchVolunteers(requestID, [volunteerID]);
        let updatedRequest = (await RequestRepository.readRequest({_id: requestID}))[0];

        // TODO -> Notify admins
        // In progress
        // Scenario: when a volunteer is removed from a request -> send email to the admin (+ push notification) 
        notifyRequestStatusChange(updatedRequest, 'rejected'); 

        pusher.trigger(assoc._id, 'general', 'A volunteer has been unmatched from a request!'); 
        // res.send('Request updated.'); -> include ?
        
        return updatedRequest;
    } catch (e) {
        throw e;
    }
}

/**
 * Volunteer completing a request
 */
exports.completeRequest = async function(volunteerID, requestID, reason, volunteer_comment) {
    try {
         // Update a particular volunteer's volunteer0request0status to complete and append any completion info
        await RequestRepository.updateRequestComplex({'_id': requestID, 'status.volunteers.volunteer': volunteerID}, { 
            $set: {
                "status.volunteers.$.current_status": volunteer_status.COMPLETE,
                "status.volunteers.$.volunteer_response": volunteer_comment,
                "status.volunteers.$.last_notified_time": new Date()
            }
        });

        // Count the number of volunteer's who have completed this request
        let updatedRequest = (await RequestRepository.readRequest({_id: requestID}))[0];
        var completeCount = 0;
        updatedRequest.status.volunteers.forEach(volunteer => {
            if (volunteer.current_status === volunteer_status.COMPLETE) {
                completeCount += 1;
            }
        });
        // if the complete count is equal to the inital volunteer quota, complete the entire request
        if (completeCount === updatedRequest.status.volunteer_quota) {
            await RequestRepository.updateRequest(requestID, {
                $set: {
                    'status.current_status': request_status.COMPLETED,
                    'status.completed_reason': reason,
                    'status.completed_date': new Date()
                }
            });
        }

        // TODO -> Notify admins
        // In progress
        // Scenario: when a request is completed -> send a push notif to the association 
        // No email         
        pusher.trigger(updatedRequest.body.assoc_id, 'complete', request_id);
        // res.send('Request updated.'); // include ?

        return updatedRequest;
    } catch (e) {
        throw e;
    }
}

/**
 * Update the details of a request
 */
exports.updateRequestDetails = async function(requestID, updates) {
    try {
        updates["admin_info.last_modified"] = new Date()
        await RequestRepository.updateRequest(requestID, updates);
        let updatedRequest = (await RequestRepository.readRequest({_id: requestID}))[0];
        return updatedRequest;
    } catch (e) {
        throw e;
    }
}

/**
 * Unmatch pending volunteers who have been tied to a request for more than 48 hours
 */
exports.unmatchPendingVolunteers = async function(expiryTime) {
    // ***check*** are notifs required here 

    try {
        let allRequests = await RequestRepository.readRequest({});
        var expiredVolunteers = [];
        allRequests.forEach(request => {
            request.status.volunteers.forEach(volunteer => {
                if (volunteer.current_status === volunteer_status.PENDING && volunteer.last_notified_time < new Date(Date.now() - expiryTime * 60 * 60 * 1000)) {
                    if (expiredVolunteers[request._id]) {
                        expiredVolunteers[request._id].push(volunteer.volunteer);
                    } else {
                        expiredVolunteers[request._id] = [volunteer.volunteer];
                    }
                }
            });
        });
        for (var request in expiredVolunteers) {
            let volunteers = expiredVolunteers[request];
            await exports.unmatchVolunteers(request, volunteers);
        }
    } catch (e) {
        throw e;
    }
}

/**
 * Send email notif to admin when status of a request changes
 */
exports.notifyRequestStatusChange = async function(updatedRequest, action) {
    try {
        // Prepare email/pusher notifications
        // Find association, if exists (default to Covaid)
        var assoc = await AssociationService.getAssociation({'_id': updatedRequest.association}); // ***check logic*** -> make sure it defaults to Covaid

        // Find admin
        // If admin exists, send them an email 
        var foundAdmin = false; 
        for (var i = 0; i < assoc.admins.length; i++) {
            var admin = assoc.admins[i];
            if (admin.name === updatedRequest.assignee) {
                var data = {
                    sender: "Covaid@covaid.co",
                    receiver: admin.email,
                    name: updatedRequest.requester_first,
                    action: action,
                    templateName: "admin_notification",
                };
                emailer.sendNotificationEmail(data);
                foundAdmin = true; 
                break;
            }
        }

        // If no admin assigned to request, send email to association
        if (!foundAdmin) {
            var data = {
                sender: 'Covaid@covaid.co',
                receiver: assoc.email,
                name: updatedRequest.requester_first,
                action: action,
                templateName: 'org_notification',
            };
            emailer.sendNotificationEmail(data)
        }
    } catch (e) {
        throw e;
    }
}