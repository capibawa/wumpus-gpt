FROM node:20.4.0-alpine3.18

WORKDIR /usr/src/app
COPY . /usr/src/app

RUN npm install && npm run build --if-present

CMD "npm" "start"