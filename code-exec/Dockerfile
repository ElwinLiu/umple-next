# This dockerfile sets up an image to run node.js, which will
# act as a server on port 4400 to prepare to execute code
# The actual execution of the code is done in a docker-in-docker within this
# For that, see the Dockerfile in the javarunner directory
FROM alpine:3.22

RUN apk add --no-cache nodejs npm docker python3 nano

RUN addgroup -S nodeuser \
 && adduser -D -H -S nodeuser -G nodeuser

WORKDIR /usr/src/app
COPY package*.json ./

RUN npm install


# Bundle app source
COPY . .

EXPOSE 4400

RUN chown -R nodeuser:nodeuser /usr/src/app
RUN chown -R nodeuser:nodeuser /home
USER nodeuser

CMD [ "npm", "start" ]
