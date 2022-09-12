FROM openjdk:11-jre-buster
LABEL maintainer="Digitransit (digitransit.fi)" \
      version="0.1" \
      repo="https://github.com/HSLdevcom/OpenTripPlanner-data-container"

ADD build-otp-data-tools.sh ${WORK}
VOLUME /data
RUN ./build-otp-data-tools.sh && rm build-otp-data-tools.sh
