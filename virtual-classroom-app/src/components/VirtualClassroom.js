import React, { useEffect, useState } from 'react'
import { over } from 'stompjs';
import SockJS from 'sockjs-client';

var stompClient = null;

const VirtualClassroom = () => {
    /** Data and lists for all users */
    // List for students logged in, for teacher only
    const [studentList, setStudentList] = useState([]);

    // Lists are used for all teachers and students
    const [questionList, setQuestionList] = useState([]);
    const [hallpassList, setHallpassList] = useState([]);
    const [announcementList, setAnnouncementList] = useState([]);
    const [logList, setLogList] = useState([]);
    const progressList = ['Good', 'Slow', 'Stuck'];

    // User data with states
    const [userData, setUserData] = useState({
        username: '',
        connected: false,
        teacher: false,
        question: '',
        questionFinal: '',
        help: false,
        helpTime: '',
        hallpass: false,
        hallpassTime: '',
        hallpassStatus: '',
        message: '',
        progress: 'good',
        showLog: true
    });

    /************** Connection and administrative functions ****************/
    /* Occurs each time something is sent */
    useEffect(() => {
        //console.log(userData);
    }, [userData]);

    /* When there's an error, log the error to the console */
    const onError = (err) => {
        console.log(err);
    }

    /**
     * Adds message to log
     * @param {} message 
     */
    const addToLog = (message) => {
        logList.push(JSON.stringify(message));
        setLogList([...logList]);
    }

    /**
     * flips the showlog value when "Show Log" is clicked
     */
    const showLog = () => {
        userData.showLog = !userData.showLog;
        setUserData({ ...userData });
    }

    /**
     * Connects to websocket to pass information back and forth
     */
    const connect = () => {
        let Sock = new SockJS('http://localhost:8080/ws');
        stompClient = over(Sock);

        // Runs onConnected if worked, onError if not
        stompClient.connect({}, onConnected, onError);
    }

    /**
     * Subscribes to channels once user is connected
     */
    const onConnected = () => {
        // connected will determine what part of the page shows below
        userData.connected = true;
        setUserData({ ...userData });

        if (userData.username == 'teacher') {
            stompClient.subscribe('/teacher', onTeacherMessageReceived);
        } else {
            stompClient.subscribe('/student/' + userData.username + '/private', onStudentMessageReceived);
            stompClient.subscribe('/announcement', onAnnoucement);
        }
        userJoin();
    }

    /**
     * Sends teacher a message that student joined the server
     */
    const userJoin = () => {
        var name = userData.username.toString();
        var message = name + " just joined the server.";

        sendTeacherMessage(message, "JOIN");
    }

    /* tracks value of input in teacher page */
    const handleAnnouncement = (event) => {
        const { value } = event.target;
        setUserData({ ...userData, "question": value });
    }

    /* captures announcement, adds to announcement list and sends message */
    const sendAnnouncement = () => {
        var announcement = userData.question.toString();

        sendAnnouncementMessage(announcement);

        announcementList.push(announcement);
        setAnnouncementList([...announcementList]);
    }

    /* sends announcement from teacher to announcement */
    const sendAnnouncementMessage = (message) => {
        var now = getTime();
        var announcement = message + " (" + now + ")";

        var chatMessage = {
            name: userData.username,
            date: now,
            message: announcement
        };

        console.log(chatMessage);
        addToLog(chatMessage);

        stompClient.send("/app/message/announcement", {}, JSON.stringify(chatMessage));
    }

    /* handles updated username input before login occurs */
    const handleUsername = (event) => {
        const { value } = event.target;
        setUserData({ ...userData, "username": value });
    }

    /* handles button click for student to login */
    const registerUser = () => {
        // determines if user is teacher based on their name
        userData.teacher = userData.username === "teacher";

        // only show log if teacher
        userData.showLog = false;
        //userData.showLog = userData.username === "teacher";

        // save data
        setUserData({ ...userData });

        // connect to system
        connect();
    }

    /**
     * Handles log out button
     * If teacher logs out, all students are forced to log out
     * If student logs out, student is removed from lists
     */
    const logout = () => {
        if (userData.username === "teacher") {
            sendAnnouncementMessage("teacher logged out");
        } else {
            sendTeacherMessage("logging out", "LEAVE");
        }

        userData.connected = false;
        setUserData({ ...userData });
    }

    /*********************** Teacher Functions *********************************************/

    /**
     * When message is received on teacher's subscription channel, this
     * determiend what it is going to do based on the payload's status value
     * @param {*} payload 
     */
    const onTeacherMessageReceived = (payload) => {
        var payloadData = JSON.parse(payload.body);
        addToLog(payloadData);

        switch (payloadData.status) {
            case 'JOIN':
                // Adds student to teacher's student list
                if (payloadData.name !== 'teacher') {
                    sendStudentMessage(payloadData.name, "Welcome", "JOIN");

                    studentList.push(payloadData.name + " - Started");
                    setStudentList([...studentList]);
                }
                break;
            case 'HALLPASS':
                handleHallPassRequest(payloadData.name, payloadData.message);
                break;
            case 'ASSISTANCE':
                handleAssistanceRequest(payloadData.name, payloadData.message);
                break;
            case 'LEAVE':
                removeStudent(payloadData.name);
                break;
            case 'PROGRESS':
                changeProgressTeacher(payloadData.name, payloadData.message);
                break;
            default:
                console.log(payloadData);
        }
    }

    /**
     * When a student logs out, this removes student from the main student list,
     * the question list and the hall pass list
     * @param {*} studentname 
     */
    const removeStudent = (studentname) => {
        removeItemFromList(studentList, studentname);
        setStudentList([...studentList]);

        removeItemFromList(questionList, studentname);
        setQuestionList([...questionList]);

        removeItemFromList(hallpassList, studentname);
        setHallpassList([...hallpassList]);
    }

    /**
     * When student asks a question, add it to the question list. If the 
     * message is "cancel," remove them from the list. Changing the question is
     * disabled when they are in the queue, so no chance of student typing cancel
     * @param {*} studentname 
     * @param {*} message 
     */
    const handleAssistanceRequest = (studentname, message) => {
        if (message === "****************cancel****************") {
            removeItemFromList(questionList, studentname);
        } else {
            var now = getTime();
            questionList.push(studentname + " - " + message + " (" + now + ")");
        }

        setQuestionList([...questionList]);
    }

    /**
     * Helper method to remove target student from list
     * @param {*} list 
     * @param {*} target 
     */
    const removeItemFromList = (list, target) => {
        for (var i = 0; i < list.length; i++) {
            if (list[i].includes(target))
                list.splice(i, 1);
        }
    }

    /**
     * Teacher handles student hall pass request, whether canceled or requested
     * @param {*} studentname 
     * @param {*} message 
     */
    const handleHallPassRequest = (studentname, message) => {
        if (message === "cancel") {
            removeItemFromList(hallpassList, studentname);
        } else {
            var now = getTime();
            hallpassList.push(studentname + " - Requested (" + now + ")");
        }
        setHallpassList([...hallpassList]);
    }

    /**
     * Grants hall pass to student
     * @param {*} value 
     */
    const grantHallPassTeacher = (value) => {
        // Must find student name in list without status
        var index = value.indexOf(" - ");
        var name = value.substring(0, index).trim();

        // tell student hall pass is granted
        sendStudentMessage(name, "granted", "HALLPASS");

        // remove name
        removeItemFromList(hallpassList, name);

        // replace name with Granted status
        var now = getTime();
        hallpassList.splice(0, 0, name + " - Granted (" + now + ")");
        setHallpassList([...hallpassList]);
    }

    /**
     * If student cancles request, remove them from teacher list
     * @param {*} value 
     */
    const cancelHallpassTeacher = (value) => {
        var index = value.indexOf(" - ");
        var name = value.substring(0, index).trim();

        sendStudentMessage(name, "cancelled", "HALLPASS");

        removeItemFromList(hallpassList, name);
        setHallpassList([...hallpassList]);
    }

    /**
     * Handles "clear announcement" button for both teacher and student
     */
    const clearAnnouncements = () => {
        if (userData.username === "teacher") {
            sendAnnouncementMessage("clear all announcements");
        }
        announcementList.splice(0, announcementList.length);
        setAnnouncementList([...announcementList]);
    }

    /**
     * Determines what to do with hall pass request based on message
     * @param {*} message 
     */
    const handleHallPassResponse = (message) => {
        if (message === "cancelled") {
            cancelHallpassStudent();
        } else if (message === "granted") {
            grantHallpassStudent();
        } else {
            console.log(message);
        }
    }

    /**
     * Handles when a teacher cancels a student request
     */
    const cancelHallpassStudent = () => {
        userData.hallpass = false;
        userData.hallpassTime = '';
        userData.hallpassStatus = "Cancelled";
        setUserData({ ...userData });

        var now = getTime();
        hallpassList.push("Hall pass request cancelled by teacher at " + now + ".");
        setHallpassList([...hallpassList]);
    }

    /**
     * Handles the grant hall pass button, sends message to student so they
     * know hall pass has been granted
     */
    const grantHallpassStudent = () => {
        var now = getTime();

        userData.hallpass = true;
        userData.hallpassTime = now;
        userData.hallpassStatus = "Granted";
        setUserData({ ...userData });


        hallpassList.push("Hall pass request granted by teacher at " + now + ".");
        setHallpassList([...hallpassList]);
    }

    /**
     * Handles announcement broadcast, including forced log out because teacher left and
     * clearing announcmements
     * @param {} payload 
     */
    const onAnnoucement = (payload) => {
        var payloadData = JSON.parse(payload.body);
        addToLog(payloadData);

        if (payloadData.status === "LEAVE" || payloadData.message.includes("teacher logged out")) {
            logout();
        } else if (payloadData.message.includes("clear all announcements")) {
            clearAnnouncements();
        } else {
            // Adds announcement to list and updates data
            var announcement = payloadData.message;
            announcementList.push(announcement);
            setAnnouncementList([...announcementList]);

            //console.log("Announcement: " + announcement);
        }


    }



    /**
     * Handles message when it is received on the student's private message
     * subscription
     * @param {} payload 
     */
    const onStudentMessageReceived = (payload) => {
        var payloadData = JSON.parse(payload.body);
        addToLog(payloadData);

        switch (payloadData.status) {
            case 'JOIN':
                console.log("Welcome " + userData.name);
                break;
            case 'HALLPASS':
                handleHallPassResponse(payloadData.message);
                break;
            case 'ASSISTANCE':
                if (payloadData.message === "complete") {
                    completeAssistanceStudent();
                }
                break;
            case 'LEAVE':
                logout();
            default:
                console.log(payloadData);
        }
    }



    /**
     * Tells teacher that student has changed their progress status
     * @param {*} value 
     */
    const changeProgressStudent = (value) => {
        userData.progress = value
        setUserData({ ...userData });

        sendTeacherMessage(value, "PROGRESS");
    }

    /**
     * Changes progress status in student list when student has changed it
     * @param {*} student 
     * @param {*} value 
     */
    const changeProgressTeacher = (student, value) => {
        // Finds student name in list
        for (var i = 0; i < studentList.length; i++) {
            if (studentList[i].includes(student))
                // resets the student's status to the new status
                studentList.splice(i, 1, student + " - " + value);
        }

        // change student list data
        setStudentList([...studentList]);
    }


    /**
     * Helper method that composes a message and sends it to the teacher
     * @param {*} message could be question or further info regarding status
     * @param {*} status helps determine what the teacher side will do
     */
    const sendTeacherMessage = (message, status) => {
        var now = getTime();
        var name = userData.username.toString();

        var chatMessage = {
            name: name,
            message: message,
            date: now,
            status: status
        };
        console.log(chatMessage);
        addToLog(chatMessage);

        stompClient.send("/app/message/teacher", {}, JSON.stringify(chatMessage));
    }

    /**
     * Sends a message to a particular student on their private message channel
     * @param {*} studentname student account to be sent to
     * @param {*} message information to send
     * @param {*} status helps determine what should be done
     */
    const sendStudentMessage = (studentname, message, status) => {
        var now = getTime();

        var chatMessage = {
            name: studentname,
            message: message,
            date: now,
            status: status
        };
        console.log(chatMessage);
        addToLog(chatMessage);

        stompClient.send("/app/message-student", {}, JSON.stringify(chatMessage));
    }


    /**
     * Updates the value when student types in question box
     * @param {*} event 
     */
    const handleQuestion = (event) => {
        const { value } = event.target;
        userData.question = value;
        setUserData({ ...userData });
    }

    /**
     * Handles when studnet clicks "Request Assistance" button
     * @param {*} question 
     */
    const requestAssistance = (question) => {
        var question = userData.question.toString();

        userData.questionFinal = question; // stops student from being able to update
        userData.question = question; // question value is updated when student updates
        userData.help = true;
        userData.helpTime = getTime(); // tracks time, but might be redundant
        setUserData({ ...userData });

        // sends teacher message
        sendTeacherMessage(question, "ASSISTANCE");

        // Adds information to student log
        var now = getTime();
        questionList.push("Assistance requested at " + now + ".");
        setQuestionList([...questionList]);
        /* */
    }

    /**
     * Student clicks "cancel assistance" and sends cancel message to teacher
     */
    const cancelAssistance = () => {
        userData.question = '';
        userData.help = false;
        userData.helpTime = "";
        setUserData({ ...userData });

        // Sending long message so that it is unlikely student will cancel their own question
        sendTeacherMessage("****************cancel****************", "ASSISTANCE");

        // Update student interface
        var now = getTime();
        questionList.push("Assistance request cancelled at " + now + ".");
        setQuestionList([...questionList]);
    }

    /**
     * When teacher indicates that question is completed, student gets message
     * that it was completed and when
     */
    const completeAssistanceStudent = () => {
        userData.question = '';
        userData.help = false;
        userData.helpTime = '';
        setUserData({ ...userData });

        var now = getTime();
        questionList.push("Assistance request completed at " + now + ".");
        setQuestionList([...questionList]);
    }

    /**
     * Send message to student that teacher completed assistance so their question
     * should be canceled
     */
    const completeAssistanceTeacher = (value) => {
        var index = value.indexOf(" - ");
        var name = value.substring(0, index).trim();
        console.log("complete: " + name);

        sendStudentMessage(name, "complete", "ASSISTANCE");

        removeItemFromList(questionList, name);
        setQuestionList([...questionList]);
    }

    /**
     * Student requests hall pass by sending message to teacher
     */
    const requestHallPass = () => {
        var now = getTime();

        userData.hallpass = true;
        userData.hallpassTime = now;
        userData.hallpassStatus = "Waiting";
        setUserData({ ...userData });

        sendTeacherMessage("request", "HALLPASS");

        hallpassList.push("Hall pass requested at " + now + ".");
        setHallpassList([...hallpassList]);
    }

    /**
     * Student cancels hall pass. Teacher can also cancel hall pass.
     */
    const cancelHallPass = () => {
        userData.hallpass = false;
        userData.hallpassTime = "";
        setUserData({ ...userData });

        sendTeacherMessage("cancel", "HALLPASS");

        var now = getTime();
        hallpassList.push("Hall pass request cancelled at " + now + ".");
        setHallpassList([...hallpassList]);
    }

    /**
     * Helper method to format time
     * @returns time as hh:MM
     */
    const getTime = () => {
        let date_ob = new Date();
        let hours = (date_ob.getHours()) % 12;
        let min = date_ob.getMinutes();
        let time = hours + ":";
        if (min < 10) time += 0;
        time += min;
        return time;
    }


    /* Builds the page for output */
    return (
        <div className="container">
            <h1>Welcome to Ms. McD's Virtual Classroom</h1>
            {userData.connected ?
                <div className="connected">
                    {userData.teacher
                        ? // if user is teacher
                        <div className="teacher">
                            <h2>Hello, teacher!</h2>
                            <h3>Student List</h3>
                            <ul>
                                {studentList.map((name, index) => (<li>{name}</li>))}
                            </ul>

                            <h3>Question List</h3>
                            <ul>
                                {questionList.map((name) => ( // give each student a complete button to put hand down
                                    <li>{name}&nbsp;&nbsp;<button value={name} onClick={e => completeAssistanceTeacher(e.target.value)}>Done</button></li>
                                ))}
                            </ul>
                            <h3>Hall Pass List</h3>
                            <ul>
                                {hallpassList.map((name, index) => ( // give each student a grant and cancel button
                                    <li>{name}
                                        &nbsp;&nbsp;<button value={name} onClick={e => grantHallPassTeacher(e.target.value)}>Grant</button>
                                        &nbsp;&nbsp;<button value={name} onClick={e => cancelHallpassTeacher(e.target.value)}>Cancel</button>
                                    </li>

                                ))}
                            </ul>

                            <h2>Announcements</h2>
                            <p><input
                                id="announcement"
                                placeholder="Enter your announcement here"
                                name="announcement"
                                value={userData.question}
                                onChange={handleAnnouncement}
                                margin="normal"
                            />
                                <button type="button" onClick={sendAnnouncement}>Send Announcement</button></p>
                            <p><button type="button" onClick={clearAnnouncements}>Clear Announcements</button></p>

                            <ul>
                                {announcementList.map((message, index) => (<li>{message}</li>))}
                            </ul>
                        </div>
                        : // if user is not teacher
                        <div className="student">
                            <h2>Hello, {userData.username}!</h2>
                            <h3>Announcements:</h3>
                            <ul>
                                {announcementList.map((message, index) => (<li>{message}</li>))}
                            </ul>
                            <h3>Progress</h3>
                            {progressList.map((value) => (
                                // creates radio buttons for progress status
                                <div><input type="radio" name="progress" value={value} id={value} onClick={e => changeProgressStudent(e.target.value)} />
                                    <label for={value}>{value}</label></div>

                            ))}
                            <h3>Ask a Question</h3>
                            {userData.help
                                ? // if user has requested assistance
                                <div><h4>Waiting for Assistance</h4>
                                    <p>Question: {userData.questionFinal}</p>
                                    <p><button type="button" onClick={cancelAssistance}>Cancel Assistance</button></p></div>
                                : // if user has not requested assistance
                                <div>
                                    <p>Question:<br />
                                        <input
                                            id="help-comment"
                                            placeholder="Enter your question here"
                                            name="question"
                                            value={userData.question}
                                            onChange={handleQuestion}
                                            margin="normal"
                                        /></p>
                                    <p><button type="button" onClick={requestAssistance}>Request Assistance</button></p>
                                </div>
                            }
                            {userData.showLog
                                ? // if show log is true
                                <ul>
                                    {questionList.map((name, index) => (<li>{name}</li>))}
                                </ul>
                                : // if show log is false
                                <div></div>
                            }

                            <h3>Hall Pass</h3>
                            <p>{userData.hallpassStatus}</p>
                            {userData.hallpass
                                ? // if hall pass has been requested
                                <p><button type="button" onClick={cancelHallPass}>Cancel Hall Pass</button></p>
                                : // if hall pass has not been requested
                                <p><button type="button" onClick={requestHallPass}>Request Hall Pass</button></p>
                            }
                            {userData.showLog
                                ? // if show log is true
                                <ul>
                                    {hallpassList.map((name, index) => (
                                        <li>{name}</li>

                                    ))}
                                </ul>
                                : // if show log is false
                                <div></div>

                            }


                        </div>
                    }
                    <p><button onClick={logout}>Log Out</button>&nbsp;&nbsp;
                        <button onClick={showLog}>Show Log</button></p>
                    {userData.showLog
                        ? // if show log is true
                        <div className="log">
                            <h4>Log</h4>
                            <ul>
                                {logList.map((message, index) => (
                                    <li>{message}</li>

                                ))}
                            </ul>
                        </div>
                        : // if show log is false
                        <div className="log"></div>
                    }
                </div>
                : // if not connected, show register box

                <div className="register">
                    <input
                        id="user-name"
                        placeholder="Enter your name"
                        name="userName"
                        value={userData.username}
                        onChange={handleUsername}
                        margin="normal"
                    />
                    <button type="button" onClick={registerUser}>
                        connect
                    </button>
                </div>

            }
        </div>
    )
}

export default VirtualClassroom