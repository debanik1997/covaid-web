import React, { useState, useEffect } from "react";
import Container from 'react-bootstrap/Container';
import Jumbotron from 'react-bootstrap/Jumbotron';
import Button from 'react-bootstrap/Button'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Navbar from 'react-bootstrap/Navbar'
import RequestsDashboard from './RequestsDashboard'
import VolunteerRequests from './VolunteerRequests';
import VolunteerList from './VolunteerList';
import OrgLogin from './OrgLogin'
import Cookie from 'js-cookie'

import fetch_a from './util/fetch_auth';

export default function OrganiationPortal(props) {

  const [firstTab, setFirstTab] = useState(true); 
  const [showLogin, setShowLogin] = useState(false); 
  const [association, setAssociation] = useState({});

  function fetchAssociation() {
    fetch_a('org_token', '/api/association/current')
      .then((response) => response.json())
      .then((association_response) => {
		  setAssociation(association_response)
      })
      .catch((error) => {
        console.error(error);
      });
  	}

  const handleHideLogin = () => {
	  setShowLogin(false)
  }

  const login = () => {
	fetchAssociation()
  }

  useEffect(() => {
	  if (Cookie.get("org_token")) {
		  fetchAssociation()
	  } else {
		  setShowLogin(true)
	  }
  }, []);

  return (<>
    <link href="https://fonts.googleapis.com/css?family=Baloo+Chettan+2:400&display=swap" rel="stylesheet"></link>
    <Navbar collapseOnSelect 
            variant="light" 
            expand="md"
            className = {'customNav'}>
		<Navbar.Brand className={'home'} href = {window.location.protocol + '//' + window.location.host}
			style={{'color': 'white'}}>
			covaid
		</Navbar.Brand>
		<Navbar.Collapse id="basic-navbar-nav">
			
		</Navbar.Collapse>
    </Navbar>
    <div>
		<Jumbotron fluid id="jumbo-volunteer">
			<Container id="jumbo-container-volunteer">
				<Row>
					<Col lg={2} md={1} sm={0}>
					</Col>
					<Col>
						<h1 id="jumboHeading">Welcome back, </h1>
						<h1 id="jumboHeading">{association.name}</h1>
						<p id="jumboText">This is your organization portal, a place for you to manage volunteers and requests in your area</p>	
					</Col>
				</Row>
			</Container>
		</Jumbotron>
      <Container id="volunteer-info">
			<Row className="justify-content-md-center">
				<Col></Col>
					<Col lg={6} md={8} sm={10}>
						<Container style={{padding: 0,  marginLeft: 0}}> 
							<Button id={firstTab ? "tab-button-selected" : "tab-button"} onClick={() => {setFirstTab(true)}}>Unmatched</Button>
							<Button id={!firstTab ? "tab-button-selected" : "tab-button"} onClick={() => {setFirstTab(false)}}>Volunteers</Button>
						</Container>
						<Container className="shadow mb-5 bg-white rounded" id="yourOffer"
							style={firstTab ? {'display': 'block'} : {'display': 'none'}}>
							<RequestsDashboard state = {props.state} association={association}/>
						</Container>
						<Container className="shadow mb-5 bg-white rounded" id="request-view"
							style={firstTab ? {'display': 'none'} : {'display': 'block'}}>
							<VolunteerList state={props.state}/>
						</Container>
					</Col>
				<Col ></Col>
			</Row>
      </Container>
    </div>

	<OrgLogin showLogin={showLogin} handleHideLogin={handleHideLogin} login={login} />
  </>
  );
}
