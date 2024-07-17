import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import redis from 'k6/x/redis';

let getApiTrend = new Trend('get_api_duration');
let postApiTrend = new Trend('post_api_duration');
let patchApiTrend = new Trend('patch_api_duration');
let deleteApiTrend = new Trend('delete_api_duration');

let getApiFailureRate = new Rate('get_api_failures');
let postApiFailureRate = new Rate('post_api_failures');
let patchApiFailureRate = new Rate('patch_api_failures');
let deleteApiFailureRate = new Rate('delete_api_failures');

export const options = {
    vus: 30,
    duration: '30m',
    thresholds: {
        'get_api_duration': ['p(95)<500'],
        'post_api_duration': ['p(95)<500'],
        'patch_api_duration': ['p(95)<500'],
        'delete_api_duration': ['p(95)<500'],
        'get_api_failures': ['rate<0.1'],
        'post_api_failures': ['rate<0.1'],
        'patch_api_failures': ['rate<0.1'],
        'delete_api_failures': ['rate<0.1'],
    },
};

const urlPrefix = 'http://host.docker.internal:8080/comment';

const redisClient = redis.Client('redis://host.docker.internal:7379');


export function setup() {
    //*
    redisClient.sendCommand('FLUSHALL');
    let response = http.get(urlPrefix);
    if (response.status !== 200) {
        console.error(`Setup failed, server returned status ${response.status}`);
        return [];
    }

    let initialIds = JSON.parse(response.body).map(comment => comment.id);
    
    initialIds.forEach((id) => {
        let idString = id.toString();
        redisClient.sadd('comment', idString);
    });


    console.log('Initial ID length:', initialIds.length);
    //*/
}


export default async function () {
    const httpMethodList = ['post', 'get', 'patch', 'delete'];

    const randomId = await redisClient.spop('comment'); // 다른 테스트에서 중복으로 사용되지 않도록 일시적으로 제거
    console.log(`Random ID: ${randomId}`);

    const randomAction = httpMethodList[Math.floor(Math.random() * httpMethodList.length)];

    let response;
    if (randomAction === 'post') {
        response = http.post(urlPrefix,
            JSON.stringify({
                postId: 1,
                userId: 1,
                content: 'this is content',
                parentId: randomId,
            }),
            { headers: { 'Content-Type': 'application/json' } }
        );
        
        if (response.status === 200) {
            const newCommentId = response.body;
            await redisClient.sadd('comment', newCommentId);

            postApiTrend.add(response.timings.duration);
            postApiFailureRate.add(false);
        } 
        else postApiFailureRate.add(true);
    } 
    
    else if (randomAction === 'get') {
        response = http.get(`${urlPrefix}/${randomId}`);
        getApiTrend.add(response.timings.duration);
        getApiFailureRate.add(response.status !== 200);
    } 
    
    else if (randomAction === 'patch') {
        response = http.patch(`${urlPrefix}/${randomId}`,
            JSON.stringify({ newContent: 'this is new content' }),
            { headers: { 'Content-Type': 'application/json' } }
        );
        patchApiTrend.add(response.timings.duration);
        patchApiFailureRate.add(response.status !== 200);
    } 
    
    else if (randomAction === 'delete') {
        response = http.del(`${urlPrefix}/${randomId}`);
        if (response.status === 200) {
            await redisClient.srem('comment', randomId);

            deleteApiTrend.add(response.timings.duration);
            deleteApiFailureRate.add(false);
        }
        else deleteApiFailureRate.add(true);
    }

    if ((response.status === 200) && (randomAction !== 'delete')) {
        await redisClient.sadd('comment', randomId); // delete가 아닌 경우 일시적으로 제거했던 id 다시 추가
    }
    
    sleep(1);
}
