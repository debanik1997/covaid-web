import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';

import Form from 'react-bootstrap/Form'
import Col from 'react-bootstrap/Col'
import Row from 'react-bootstrap/Row'

export default function SelectionForm(props) {

    const findCurrAssoc = (assocName) => {
        if (props.associations.length > 0) {
            return props.associations.filter(function(assoc) {
                return assoc['name'] === assocName;
            })[0];
        } else {
            return {}
        }
    }

    if (Object.keys(props.associations).length === 0) {
        return (<></>);
    } else {
        return (
            <>
                <h5 className="titleHeadings" style = {{marginTop: '0px', marginBottom: '4px'}}>
                    Please choose an organization
                </h5>
                <p id="createAccountText" style={{marginBottom: 5}}>
                    Choose an organization you would like to support with. You will be a volunteer under 
                    this organization and receive requests from people who need help here.
                </p>
                <Row>
                    <Col xs={12}>
                        <Form.Group controlId="payment" bssize="large">
                            <Form.Control as="select"
                                        id="orgSelect"
                                        onChange={(e) => {
                                            e.persist();
                                            const foundAssoc = findCurrAssoc(e.target.value);
                                            if (Object.keys(foundAssoc).length > 0) {
                                                props.setState({currentAssoc: foundAssoc});
                                            }
                                        }}
                                        value = {props.currentAssoc ? props.currentAssoc['name'] : "No Association"}
                                        style = {{fontSize: 15}}>
                                {props.associations.map((assoc) => {
                                    return <option style={{textIndent: 10}}>{assoc['name']}</option>;
                                })}
                            </Form.Control>
                        </Form.Group>
                    </Col>
                </Row>
            </>
        );
    }
}