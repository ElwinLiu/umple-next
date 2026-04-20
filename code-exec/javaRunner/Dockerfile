FROM alpine:3.22

RUN addgroup -S nodeuser
RUN adduser -D -H -S nodeuser -G nodeuser

RUN apk upgrade --no-cache && apk add --no-cache python3 openjdk17

RUN mkdir output 
RUN mkdir input

COPY javaRunner/javaRunner.sh /
RUN chmod +x /javaRunner.sh
RUN chown -R nodeuser /output
RUN chown -R nodeuser /input
RUN chmod 700 /output
RUN chmod 755 /input

USER nodeuser

ENTRYPOINT ["/javaRunner.sh"]
