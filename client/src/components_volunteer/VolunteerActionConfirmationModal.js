/**
 * Confirmation modal for changing status of a request (volunteer)
 */

import React from 'react';
import Button from 'react-bootstrap/Button'
import Modal from 'react-bootstrap/Modal' 
import Form from 'react-bootstrap/Form'
import { useFormFields } from "../libs/hooksLib";
import fetch_a from '../util/fetch_auth';
import 'bootstrap/dist/css/bootstrap.min.css';

export default function VolunteerActionConfirmationModal(props) {
    // fields.comment is used if a request is attempting to be completed
    // Filled in with request completion details
    const [fields, handleFieldChange] = useFormFields({
        comment: ""
    });

    // Update request completion details on backend
    // Callback to parent modal
    const complete = () => {
        let form = {
            'reason': 'Volunteer completed',
            'volunteer_comment': fields.comment,
        };

        var url = "/api/request/completeRequest?";
        let params = {
            'ID' : props.currRequest._id
        }
        let query = Object.keys(params)
                .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
                .join('&');
        url += query;
 
        fetch_a('token', url, {
            method: 'put',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(form)
        }).then((response) => {
            if (response.ok) {
                props.setShowConfirmationModal(false); 
                props.setOriginalModal(false)
                props.complete();
            } else {
                alert("Unable to complete, please email us at covaidco@gmail.com.");
            }
        }).catch((e) => {
            console.log(e);
        });
    }

    // Update request reject on backend
    // Callback to parent modal
    const reject = () => {
        const requester_id = props.currRequest._id;
        const volunteer_id = props.currRequest.status.volunteer;

        var url = "/api/request/rejectRequest?";
        let params = {
            'ID' : props.currRequest._id
        }
        let query = Object.keys(params)
                .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
                .join('&');
        url += query;
        fetch_a('token', url, {
            method: 'put'
        }).then((response) => {
            if (response.ok) {
                props.setShowConfirmationModal(false); 
                props.setOriginalModal(false)
                props.reject();
            } else {
                alert("Unable to reject, please email us at covaidco@gmail.com.");
            }
        }).catch((e) => {
            console.log(e);
        });
    }

    // Determine which action to process (complete or reject)
    const action = props.action === 'complete' ? complete : reject;

    // Input validation for confirm case
    const confirmComplete = () => {
        if (props.action !== 'complete') {
            return false;
        } else {
            if (fields.comment.length < 10) {
                return true;
            }
            else {
                return false;
            }
        }
    }
    // Generate a request comment form if the modal is in 'complete' mode.
    const getCommentForm = (action) => {
        if (action === 'complete') {
            return <>
                <h5 id="regular-text-bold" style = {{marginTop: 0, marginBottom: 5}}>
                            How did you complete this request?
                        </h5>
                <Form.Group controlId="comment" bssize="large">
                    <Form.Control value={fields.comment} onChange={handleFieldChange} as="textarea" rows="2" placeholder="Ex: I delivered groceries to this person's front door! (min. 10 characters)" />
                </Form.Group>
            </>
        } else {
            return <></>;
        }
    }

    return (
        <>
            <Modal size="md" show={props.showModal} onHide={() => {props.setShowConfirmationModal(false); props.setOriginalModal(true)}}>
                <Modal.Header closeButton>
                    <Modal.Title id="small-header">{props.title}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p id="regular-text">{props.confirmation}</p>
                    {getCommentForm(props.action)}
                    <Button id="large-button" disabled={confirmComplete()} style={{backgroundColor: props.buttonColor, border: '1px solid ' + props.buttonColor}} onClick={action}>
                        Confirm
                    </Button>
                </Modal.Body>
            </Modal>
        </>
    )
}