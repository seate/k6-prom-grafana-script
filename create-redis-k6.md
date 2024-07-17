[redis를 사용 가능한 k6](https://github.com/grafana/xk6-redis)를 빌드

1. Install `xk6`:
```shell
go install go.k6.io/xk6/cmd/xk6@latest #go 설치 필수
```

2. Build the binary:
```shell
xk6 build --with github.com/grafana/xk6-redis
```

3. make docker image

docker file
```dockerfile
FROM ubuntu:20.04

# 필요한 패키지 설치
RUN apt-get update && apt-get install -y ca-certificates

# 빌드된 k6 바이너리를 컨테이너로 복사, 파일 이름 주의
COPY ./k6 /usr/local/bin/k6

# k6 실행
ENTRYPOINT ["k6"]
CMD ["--help"]
```

```shell
docker build -t {docker_name}/{docker_repository_name}:latest
```

4. docker login & hub push
```shell
docker login -u {docker_name} -p {docker_password = docker_accesstoken} #docker access token으로 로그인해야 함
```

```shell
docker push {docker_name}/{docker_repository_name}:latest
```

5. execute
```shell
docker-compose up
```

