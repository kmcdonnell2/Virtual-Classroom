package com.msmcd.queue.controller;

import com.msmcd.queue.model.*;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class VirtualClassController {
	@Autowired
	private SimpMessagingTemplate simpMessageTemplate;
	
	@MessageMapping("/message/teacher") // send to /app/message
	@SendTo("/teacher")
	public Message receiveTeacherMessage(@Payload Message message) {
		System.out.println("Received Teacher Message\n" + message);
		return message;
	}

	@MessageMapping("/message/announcement") // send to /app/message
	@SendTo("/announcement")
	public Message receiveAnnouncement(@Payload Message message) {
		System.out.println("Received Announcement\n" + message);
		return message;
	}

	
	@MessageMapping("/message/student")
	public Message receiveStudentMessage(@Payload Message message) {
		this.simpMessageTemplate.convertAndSendToUser(message.getSenderName(), "/student", message); // listen to
																										// /user/name/private
		System.out.println(message.toString());
		return message;
	}
}
