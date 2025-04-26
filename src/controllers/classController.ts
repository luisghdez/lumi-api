// src/controllers/classController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import {
    createClass,
    getClassesForUser,
    ClassSummary,
    getCoursesForClass,
  } from "../services/classService";

interface CreateClassBody {
  name: string;
  identifier: string;    // e.g. CRN or teacher’s own ID
  colorCode: string;     // e.g. "#FF33AA"
}

export async function createClassController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { name, identifier, colorCode } =
      request.body as CreateClassBody;
    const user = (request as any).user;
    if (!user?.uid) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const newClass = await createClass(user.uid, {
      name,
      identifier,
      colorCode,
    });

    return reply.status(201).send(newClass);
  } catch (error) {
    console.error("Error creating class:", error);
    return reply
      .status(500)
      .send({ error: "Failed to create classroom" });
  }
}

export async function getClassesController(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const user = (request as any).user;
    if (!user?.uid) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  
    try {
      const classes: ClassSummary[] = await getClassesForUser(user.uid);
      return reply.status(200).send(classes);
    } catch (err) {
      console.error("Error fetching classes:", err);
      return reply
        .status(500)
        .send({ error: "Failed to fetch classrooms" });
    }
  }

  export async function getClassCoursesController(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const user = (request as any).user;
      if (!user?.uid) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
  
      const classId = (request.params as { id: string }).id;
      const courses = await getCoursesForClass(user.uid, classId);
  
      return reply.status(200).send(courses);
    } catch (err) {
      console.error("Error fetching class courses:", err);
      return reply
        .status(500)
        .send({ error: "Failed to fetch class courses" });
    }
  }