import React, { useState, useEffect } from "react";
import fetch_a from './util/fetch_auth';
import Pusher from 'pusher-js';
import { useToasts } from 'react-toast-notifications'

import Container from 'react-bootstrap/Container';
import Jumbotron from 'react-bootstrap/Jumbotron';
import Button from 'react-bootstrap/Button'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Badge from 'react-bootstrap/Badge'
import UnmatchedRequests from './UnmatchedRequests'
import OrgLogin from './components_orgpage/OrgLogin'
import Cookie from 'js-cookie'
import NavBar from './components/NavBar'
import Footer from './components/Footer'

import RequestDetails from './components_orgpage/RequestDetails';
import VolunteerDetails from './components_orgpage/VolunteerDetails';
import NewMap from './components_orgpage/NewMap'
import VolunteersModal from './components_orgpage/VolunteersModal';
import AdminModal from './components_orgpage/AdminModal';
import BeaconCreation from './components_orgpage/BeaconCreation';
import OrgResourcesModal from './OrgResourcesModal';
import LiveBeaconView from './components_orgpage/LiveBeaconView'
import { sortFn } from './components_orgpage/OrganizationHelpers'
import { generateURL, convertTime } from './Helpers'
import './OrganizationPage.css'


export default function OrganiationPortal(props) {

	const { addToast } = useToasts()
	const [currTabNumber, setCurrTab] = useState(1); 
	const [showLogin, setShowLogin] = useState(false); 
	const [association, setAssociation] = useState({});
	const [volunteers, setVolunteers] = useState([]);
	const [volunteersModal, setVolunteersModal] = useState(false);
	const [adminModal, setAdminModal] = useState(false);
	const [beaconModal, setBeaconModal] = useState(false);
	const [resourceModal, setResourceModal] = useState(false);
	const [allRequests, setAllRequests] = useState([]);
	const [unmatched, setUnmatched] = useState([]);
	const [matched, setMatched] = useState([]);
	const [completed, setCompleted] = useState([]);
	const [beacons, setBeacons] = useState([]);
	const [requesterMap, setRequesterMap] = useState(true);
	const [volunteerMap, setVolunteerMap] = useState(false);
	const [volunteerDetailModal, setVolunteerDetailsModal] = useState(false);
	const [requestDetailsModal, setRequestDetailsModal] = useState(false);
	const [currVolunteer, setCurrVolunteer] = useState({});
	const [currRequest, setCurrRequest] = useState({});

	const [admin, setAdmin] = useState({});

	const [beaconView, setBeaconView] = useState(false);
	const [isLoaded, setIsLoaded] = useState(false);
	const [width, setWidth] = useState(window.innerWidth);

	const [inRequest, setInRequest] = useState(false);
	const [inVolunteer, setInVolunteer] = useState(false);

	window.addEventListener("resize", () => {
        setWidth(window.innerWidth);
	});

	const fetchBeacons = () => {
		// Get all request types for an association
		fetch_a('org_token', '/api/beacon/', {
            method: 'get',
        }).then((response) => {
			if (response.ok) {
				response.json().then(data => {
					setBeacons(data);
				});
			} else {
				console.log("Error");
			}
		}).catch((e) => {
			console.log(e);
		});
	}

	const fetch_requests = (id) => {
			let params = {'association': id}
			var url = generateURL( "/api/request/allRequestsInAssoc?", params);

			// Get all request types for an association
			fetch(url, {
				method: 'get',
				headers: {'Content-Type': 'application/json'},
			}).then((response) => {
				if (response.ok) {
					response.json().then(data => {
						setAllRequests(data);
						var unMatchedArr = [];
						var matchedArr = [];
						var completedArr = [];
						for (var i = 0; i < data.length; i++) {
							if (data[i].status) {
								if (data[i].status.current_status === 'in_progress') {
									matchedArr.push(data[i]);
								} else if (data[i].status.current_status === 'incomplete' || data[i].status.current_status === 'pending') {
									unMatchedArr.push(data[i]);
								} else {
									completedArr.push(data[i]);
								}
							} else {
								unMatchedArr.push(data[i]);
							}
						}
						setUnmatched(unMatchedArr);
						setMatched(matchedArr);
						setCompleted(completedArr);

						var res = {}
						data.forEach(function (result) {
							if (result.time_posted) {
								var day = convertTime(result.time_posted);
								if (!res[day]) {
									res[day] = 0;
								}
								res[day]++;
							}
						});

						console.log(res)
					});
				} else {
					console.log("Error");
				}
			}).catch((e) => {
				console.log(e);
			});
	}

	const pushBeacon = (beacon) => {
		setBeacons(beacons.concat(beacon));
	}

	function fetchCurrentAdmin() {
		fetch_a('admin_token', '/api/association-admin/current')
			.then((response) => response.json())
			.then((adminResponse) => {
				setAdmin(adminResponse);
				setIsLoaded(true);
			}).catch((e) => {
				console.log(e);
			});
	}

	function login(adminMode) {
		// Get association from login
		fetch_a('org_token', '/api/association/current')
			.then((response) => response.json())
			.then((association_response) => {
				setAssociation(association_response);
				console.log(association_response);
				var pusher = new Pusher('ed72954a8d404950e3c8', {
					cluster: 'us2',
					forceTLS: true
				  });
				var channel = pusher.subscribe(association_response._id);
				channel.bind('general', function(data) {
					fetch_requests(association_response._id)
					addToast(data,
						{
							appearance: 'info',
							autoDismiss: true
						}
					)
				});
				channel.bind('complete', function(data) {
					fetch_requests(association_response._id)
					addToast("Someone completed a request!",
						{
							appearance: 'success',
							autoDismiss: true
						}
					)
				});

				// All requests for an association
				fetch_requests(association_response._id);

				// All beacons
				fetchBeacons();
				
				// Get all volunteers for an association
				let params = {'association': association_response._id}
				var url = generateURL("/api/users/allFromAssoc?", params);
				fetch(url, {
					method: 'get',
					headers: {'Content-Type': 'application/json'},
				}).then((response) => {
					if (response.ok) {
						response.json().then(data => {
							var resVolunteer = data.map((volunteer) => {
								volunteer.latitude = volunteer.latlong[1];
								volunteer.longitude = volunteer.latlong[0];
								return volunteer;
							});
							resVolunteer.sort(function(a, b) {
								const x = String(a.first_name.toLowerCase())
            					const y = String(b.first_name.toLowerCase())
								return sortFn(x, y, false);
							});
							setVolunteers(resVolunteer);
							if (adminMode) {
								fetchCurrentAdmin();
							} else {
								setIsLoaded(true);
							}
						});
					} else {
						console.log(response);
					}
				}).catch((e) => {
					console.log(e);
				});
			}).catch((error) => {
				console.error(error);
			});
	}

	useEffect(() => {
		if (Cookie.get("admin_token") && Cookie.get("org_token")) {
			login(true);
		} else if (Cookie.get("org_token")) {
			login(false);
		} else {
			setShowLogin(true);
			var pusher = new Pusher('ed72954a8d404950e3c8', {
				cluster: 'us2',
				forceTLS: true
			  });
			var channel = pusher.subscribe(association._id ? association._id : "");
			channel.bind('general', function(data) {
				fetch_requests(association._id)
				addToast(data,
					{
						appearance: 'info',
						autoDismiss: true
					}
				)
			});
			channel.bind('complete', function(data) {
				fetch_requests(association._id)
				addToast("Someone completed a request!",
					{
						appearance: 'success',
						autoDismiss: true
					}
				)
			});
		}
	}, []);

	if (beaconView) {
		return <LiveBeaconView volunteers={volunteers} association={association} setBeaconView={setBeaconView} beacons={beacons} />
	}

	const switchToBeacon = () => {
		setBeaconView(true);
	}

	const displayTab = (tabNumber) => {
		if (tabNumber === currTabNumber) {
			return {'display': 'block', paddingLeft: 15, paddingTop: 15};
		} else {
			return {'display': 'none', paddingLeft: 15, paddingTop: 15};
		}
	}

	const tabID = (tabNumber) => {
		return (tabNumber === currTabNumber) ? 'tab-button-selected' : 'tab-button';
	}

	const requesterStyle = () => {
		if (!requesterMap) {
			if (currTabNumber === 1) {
				return {border: '1px solid #DB4B4B', color: '#DB4B4B'}
			} else if (currTabNumber === 2) {
				return {border: '1px solid #DB9327', color: '#DB9327'}
			} else if (currTabNumber === 3) {
				return {border: '1px solid #28A745', color: '#28A745'}
			}
		} else {
			if (currTabNumber === 1) {
				return {border: '1px solid #DB4B4B', background: '#DB4B4B', color: 'white'}
			} else if (currTabNumber === 2) {
				return {border: '1px solid #DB9327', background: '#DB9327', color: 'white'}
			} else if (currTabNumber === 3) {
				return {border: '1px solid #28A745', background: '#28A745', color: 'white'}
			}
		}
	}

	if (showLogin === true) {
		return (
			<div className="App">
				<OrgLogin login={login} setShowLogin={setShowLogin} orgReset={props.location.orgReset} />
			</div>
		)
	}

	const getName = () => {
		if (Object.keys(admin).length === 0 && admin.constructor === Object) {
			return association.name;
		} else {
			return admin.first_name;
		}
	}

	if (!isLoaded) {
		return <></>;
	}

	return ([
		<div className="App" key="1">
			<NavBar isLoggedIn={true} totalVolunteers={volunteers.length} setAdmin={setAdmin} orgPortal={true} first_name={getName()} handleShowModal={() => {}}/>
			<div style ={{zoom: '95%'}}>
				<Jumbotron fluid id="jumbo-volunteer" style={{paddingBottom: 50, paddingTop: 60}}>
					<Container style={{maxWidth: 1500}}>
						<Row>
							<Col lg={7} md={7} sm={12}>
								<h1 id="home-heading" style={{marginTop: 0}}>Welcome back,</h1>
								<h1 id="home-heading" style={{marginTop: 0}}>{association.name}!</h1>
								<p id="regular-text" style={{fontSize: 20, marginBottom: 40}}>This is your organization portal, a place for you to manage volunteers and requests in your area</p>
								<Button id="medium-button" style={{marginRight: 10, marginTop: 5}} onClick={()=>{setAdminModal(true)}}>
									Manage Organization
								</Button>
								<Button id="medium-button" style={{marginTop: 5}} onClick={()=>{setVolunteersModal(true)}}>
									View Volunteers
								</Button>{' '}
								<br/>
								<Button variant="link" id="resources-link" onClick={()=>{setResourceModal(true)}}>
									+ Add a link to your community's resources
								</Button>
							</Col>
							<Col lg={5} md={5} sm={12} style={width < 768 ? {display: 'none'} : {display: 'block'}}>
								<Container id="newOfferContainer" style={{width: "75%", marginBottom: 0, position: "absolute", marginTop: 20}}>
									<h3 id="home-heading" style={{marginTop: 0, fontSize: 20}}>
										Need a task done? {' '}
										<Badge id='task-info' style={{background: '#AE2F2F'}}>
											BETA
										</Badge> 
									</h3>
									<p id="regular-text" style={{marginBottom: 10}}>Use our <b>Beacon Notification System</b> and mass notify your volunteers about any internal organization requests</p>
									<Row>
										<Col style={{paddingRight: 5}}>
											<Button id="large-button" onClick={()=>{setBeaconModal(true)}}>
												Create Beacon
											</Button>
										</Col>
										<Col style={{paddingLeft: 5}}>
											<Button id="large-button-empty" style={{marginTop: 0, paddingLeft: 5}} onClick={()=>{setBeaconView(true)}} >
												View Live Beacons ({beacons.filter(beacon => beacon.beaconStatus===1).length})
											</Button>
										</Col>
									</Row>
								</Container>
							</Col>
						</Row>
					</Container>
				</Jumbotron>
				<Container style={{maxWidth: 2000}}>
					<Row className="justify-content-md-center">
						<Col lg={6} md={12} sm={12} style={{marginTop: -44}}>
							<Container style={{padding: 0,  marginLeft: 0}}>
								<Button id={tabID(1)} onClick={() => {setCurrTab(1)}}>Unmatched ({unmatched.length})</Button>
								<Button id={tabID(2)} onClick={() => {setCurrTab(2)}}>Matched ({matched.length})</Button>
								<Button id={tabID(3)} onClick={() => {setCurrTab(3)}}>Completed ({completed.length})</Button>
								{/* <Button id={tabID(4)} onClick={() => {setCurrTab(4)}}>Beacons ({beacons.length})</Button> */}
							</Container>
							<Container id="newOfferContainer" style={displayTab(1)}>
								<UnmatchedRequests setCurrRequest={setCurrRequest} setRequestDetailsModal={setRequestDetailsModal} 
												   mode={1} requests={unmatched} setInRequest={setInRequest}/>
							</Container>
							<Container id="newOfferContainer" style={displayTab(2)}>
								<UnmatchedRequests setCurrRequest={setCurrRequest} setRequestDetailsModal={setRequestDetailsModal} 
												   mode={2} requests={matched} setInRequest={setInRequest}/>
							</Container>
							<Container id="newOfferContainer" style={displayTab(3)}>
								<UnmatchedRequests setCurrRequest={setCurrRequest} setRequestDetailsModal={setRequestDetailsModal} 
												   mode={3} requests={completed} setInRequest={setInRequest}/>
							</Container>
							
						</Col>
						<Col lg={6} md={12} sm={12} style={{marginTop: 10}}>
							<Container id="newOfferContainer" style={{'display': 'block'}}>
								<Col xs={12} style={{padding: 0, marginBottom: 10}}>
									<p id="small-header" style={{display: 'inline'}}>{width < 600 ? 'Map' : 'Organization Map'}</p>
									<Button id={!volunteerMap ? "volunteer-not-selected" : "volunteer-selected"} onClick={() => setVolunteerMap(!volunteerMap)}>
										Volunteers
									</Button>
									<Button id={!requesterMap ? "requester-not-selected" : "requester-selected"} 
										onClick={() => setRequesterMap(!requesterMap)}
										style={requesterStyle()}>
										Requesters
									</Button>
								</Col>
								<NewMap requests={allRequests} volunteers={volunteers} mode={currTabNumber}
										unmatched={unmatched} matched={matched} completed={completed}
										requesterMap={requesterMap} volunteerMap={volunteerMap}
										volunteerDetailModal={volunteerDetailModal} association={association}
										setVolunteerDetailsModal={setVolunteerDetailsModal}
										currVolunteer={currVolunteer} setCurrVolunteer={setCurrVolunteer}
										requestDetailsModal={requestDetailsModal} setRequestDetailsModal={setRequestDetailsModal} 
										currRequest={currRequest} setCurrRequest={setCurrRequest} setInRequest={setInRequest}/>
							</Container>
						</Col>
					</Row>
				</Container>
				<VolunteersModal volunteersModal={volunteersModal}
								setVolunteersModal={setVolunteersModal}
								volunteers={volunteers}
								association={association}
								setCurrVolunteer={setCurrVolunteer}
								setVolunteerDetailsModal={setVolunteerDetailsModal}
								setInVolunteer={setInVolunteer}/>
				<AdminModal adminModal={adminModal}
							setAdminModal={setAdminModal}
							association={association}
							setAssociation={setAssociation}/>
				<OrgResourcesModal resourceModal={resourceModal}
								setResourceModal={setResourceModal}
								association={association}
								setAssociation={setAssociation}/>
				<VolunteerDetails volunteerDetailModal={volunteerDetailModal}
								setVolunteerDetailsModal={setVolunteerDetailsModal}
								currVolunteer={currVolunteer}
								setVolunteersModal={setVolunteersModal}
								currRequest={currRequest}
								requestDetailsModal={requestDetailsModal}
								setRequestDetailsModal={setRequestDetailsModal}
								inRequest={inRequest}
								inVolunteer={inVolunteer}/>
				<RequestDetails requestDetailsModal={requestDetailsModal} 
									setRequestDetailsModal={setRequestDetailsModal}
									volunteerDetailModal={volunteerDetailModal}
									setVolunteerDetailsModal={setVolunteerDetailsModal}
									setCurrVolunteer={setCurrVolunteer}
									currRequest={currRequest}
									setCurrRequest={setCurrRequest}
									association={association}
									unmatched={unmatched}
									matched={matched}
									completed={completed}
									setUnmatched={setUnmatched}
									setMatched={setMatched}
									setCompleted={setCompleted}
									mode={currTabNumber}
									volunteers={volunteers}
									admin={admin}
									setInRequest={setInRequest}/>
				<BeaconCreation beaconModal={beaconModal}
							setBeaconModal={setBeaconModal}
							association={association}
							volunteers={volunteers}
							pushBeacon={pushBeacon}
							switchToBeacon={switchToBeacon} />
			</div>
		</div>,
		<Footer key="2"/>]
	);
}
