import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { useFormFields } from "./libs/hooksLib";

import Form from 'react-bootstrap/Form'
import Button from 'react-bootstrap/Button'
import Col from 'react-bootstrap/Col'
import Row from 'react-bootstrap/Row'
import Cookie from 'js-cookie'

export default function Login() {
    const [fields, handleFieldChange] = useFormFields({
        email: "",
        password: "",
    });

    function validateForm() {
        return fields.email.length > 0 && fields.password.length > 0;
    }

    const handleSubmit = async e => {
        e.preventDefault();
        let form = {
            'user': {
                'email': fields.email,
                'password': fields.password
            }
        };
        console.log(form)
        fetch('/api/users/login/', {
            method: 'post',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(form)
        })
        .then((response) => {
            if (response.ok) {
                response.json().then(data => {
                    console.log("Login successful")
                    Cookie.set("token", data.user.token);
                    window.location.reload(false);
                });
            } else {
                alert('Incorrect Login!')
            }
        })
        .catch((e) => {
            alert('Incorrect Login!')
        });
      };

    return (
        <div className="p-3 mb-5 bg-white">
            <Form onSubmit={handleSubmit}>
                <Row className="justify-content-md-center">
                    <Col md="auto">
                    <Form.Group controlId="email" bssize="large">
                        <Form.Label>Email</Form.Label>
                        <Form.Control 
                            type="email"
                            value={fields.email}
                            onChange={handleFieldChange}
                        />
                    </Form.Group>
                    </Col>
                </Row>

                <Row className="justify-content-md-center">
                    <Col md="auto">
                    <Form.Group controlId="password" bssize="large">
                        <Form.Label>Password</Form.Label>
                        <Form.Control 
                            value={fields.password}
                            onChange={handleFieldChange}
                            type="password"
                        />
                    </Form.Group>
                    </Col>
                </Row>

                <Row className="justify-content-md-center">
                    <Col md="auto">
                    <Button variant="primary" disabled={!validateForm()} type="submit">
                        Submit
                    </Button>
                    </Col>
                </Row>
            </Form>
        </div>
    )


}