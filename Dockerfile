FROM node:11

WORKDIR /stream-utils

COPY package.json yarn.lock ./

RUN yarn

COPY . .