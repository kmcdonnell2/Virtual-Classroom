package com.msmcd.VirtualClassroomController.model;

public class Message {

	private String name;
	private String message;
	private String date;
	private Status status;
 

	public String getName() {
		return name;
	}

	public void setName(String n) {
		this.name = n;
	}

	public String getMessage() {
		return message;
	}

	public void setMessage(String message) {
		this.message = message;
	}

	public String getDate() {
		return date;
	}

	public void setDate(String date) {
		this.date = date;
	}

	public Status getStatus() {
		return status;
	}

	public void setStatus(Status status) {
		this.status = status;
	}
	
	public String toString() {
		return "User: " + name + "\nMessage: " + message + "\n";
	}
	
}
