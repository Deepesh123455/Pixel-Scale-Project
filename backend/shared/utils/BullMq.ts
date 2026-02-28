import {Queue} from "bullmq";
import { redisClient } from "../../config/redis";


export const EMAIL_QUEUE_NAME = "email_queue";

export const emailQueue = new Queue(EMAIL_QUEUE_NAME,{
    connection : redisClient as any ,
    defaultJobOptions:{
        attempts : 3,
        backoff : {
            type:"exponential",
            delay : 1000
        },
        removeOnComplete : true,
        removeOnFail : 50,
    }
})