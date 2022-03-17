FROM node:16.4
WORKDIR /app
COPY package.json /app
RUN npm install
COPY . /app
CMD node server.js
EXPOSE 9090
EXPOSE 9090/udp