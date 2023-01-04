FROM node:17.7.2-alpine

WORKDIR /usr/src/axelar-gmp-express
COPY package.json ./
RUN apk add --update --no-cache git python3 make g++
RUN npm install
COPY . ./

CMD npm run start