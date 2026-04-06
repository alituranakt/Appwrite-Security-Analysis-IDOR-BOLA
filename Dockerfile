FROM nginx:1.27-alpine

WORKDIR /usr/share/nginx/html

COPY web/ ./

EXPOSE 80
