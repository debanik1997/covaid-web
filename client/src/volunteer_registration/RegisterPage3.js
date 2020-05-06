import React, { useState, useEffect } from "react";
import PropTypes from 'prop-types';

import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Form from 'react-bootstrap/Form'
import Button from 'react-bootstrap/Button'
import Toast from 'react-bootstrap/Toast'
import ReCAPTCHA from "react-google-recaptcha";

import CheckForm from '../components/CheckForm';
import { toastTime, defaultTerms } from '../constants'
import { extractTrueObj, setTrueObj } from '../Helpers';

/**
 * Volunteer Registration (Page 3)
 */

export default function RegisterPage3(props) {
    const terms = [0, 1, 2, 3, 4, 5];
    const [neighborhoodsChecked, setNeighborhoodsChecked] = useState({});
    const [captcha, setCaptcha] = useState(false);
    const [termSentences, setTermSentences] = useState(defaultTerms);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [currentTerms, setCurrentTerms] = useState({
        0: false, 1: false, 2: false, 3: false, 4: false, 5: false
    }); 

    useEffect(() => {
        if (props.currentAssoc.resources) {
            var termsList = [
                'I have not traveled out-of-country in the past 14 days',
                'I am not exhibiting any symptoms of COVID-19 (cough, fever, etc.)',
                'I have not come in contact with a sick person in the past 14 days',
                'I have been practicing social distancing -- staying indoors, avoiding crowds, staying 6 feet away from other people if you have to go outside',
                'I will take take every CDC-provided safety precaution',
                'I understand that ' + props.currentAssoc.name + ' and Covaid are strictly volunteer groups established to help during these extraordinary times created by the COVID-19 pandemic and agree to release and hold them harmless for any damages, financial or otherwise, which may occur during my services as a volunteer.'
            ]
            setTermSentences(termsList);
        }
        setNeighborhoodsChecked(setTrueObj(props.neighborhoods));
    }, [props.currentAssoc, props.neighborhoods])

    const handleTermChange = (event, task) => { 
        setCurrentTerms(prev => ({ 
            ...prev,
            [task]: !currentTerms[task]
        }));
    }

    const goToSubmit = async e => {
        e.preventDefault();
        const valid = checkPage();
        if (valid) {
            setShowToast(false);
            const selectedNeighborhoods = extractTrueObj(neighborhoodsChecked);
            const result = { 
                'neighborhoods': selectedNeighborhoods,
            }
            props.handleSubmit(result);
        } else {
            setShowToast(true);
        }
    }

    const checkPage = () => {
        var valid = true;
        if (Object.values(neighborhoodsChecked).every(v => v === false)) {
            setToastMessage('No neighborhood selected');
            valid = false;
        }

        for (const term in currentTerms) {
            if (currentTerms[term] === false) {
                setToastMessage('Must agree to all choices');
                valid = false;
            }
        }
        
        if (captcha === false) {
            setToastMessage('Captcha not checked');
            valid = false;
        }

        if (valid === false) {
            setShowToast(true);
        }
        return valid;
    }

    return (
        <>
            <Form onSubmit={goToSubmit}>
                <h5 id="regular-text-bold" style = {{marginTop: 0, marginBottom: 4}}>
                    We&apos;ve identified the following as your primary locality
                </h5>
                <p id="regular-text" style={{marginBottom: 4, fontSize: 14}}>
                    If they seem unfamiliar, please change your location above.
                </p>
                <CheckForm obj={neighborhoodsChecked} setObj={setNeighborhoodsChecked} disabled={true}/>
                <h5 id="regular-text-bold" style = {{marginTop: 20, marginBottom: 4}}>
                    Health
                </h5>
                <p id="regular-text" style={{marginBottom: 20, fontSize: 14}}>
                    For the your safety and the safety of all community members, please check 
                    the boxes to complete the volunteer pledge. If you have any questions about 
                    any of the choices, do not fill out the form and contact us at covaidco@gmail.com.
                </p>
                <Row>
                    <Col md={12}>
                        {terms.map((term) => {
                            return <Form.Check key={term} 
                                            type = "checkbox" 
                                            id="regular-text"
                                            label = {termSentences[term]}
                                            onChange = {(evt) => { handleTermChange(evt, term) }}
                                            checked = {currentTerms[term]} 
                                            style = {{fontSize: 12, color: 'black', marginTop: 2}}/>
                        })}
                    </Col>
                </Row>
                <ReCAPTCHA sitekey="6LeZmeQUAAAAALo6YR9A7H-f7EZsYj3c0KJ189Ev"
                            onChange={() => {setCaptcha(true)}}
                            style = {{marginBottom: 0, marginTop: 20}}/>
                <Button id="large-button" style={{marginTop: 15}} type="submit">Sign up!</Button>
            </Form>
            <p id="pagenum-text">Page 3 of 3</p>
            <Toast show={showToast} delay={toastTime} onClose={() => setShowToast(false)} autohide id='toastError'>
                <Toast.Body>{toastMessage}</Toast.Body>
            </Toast>
        </>
    )
}

RegisterPage3.propTypes = {
    handleSubmit: PropTypes.func,
    currentAssoc: PropTypes.object,
    neighborhoods: PropTypes.array
}