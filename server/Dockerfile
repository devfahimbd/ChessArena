FROM node:20-slim
WORKDIR /app
COPY package.json ./
COPY prisma ./prisma/
RUN npm install
RUN npx prisma generate
COPY index.js ./
EXPOSE 8080
CMD ["node", "index.js"]