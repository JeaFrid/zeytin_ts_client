# Zeytin <🫒/>

Developed with love by JeaFriday!

<p align="center">
  <a href="https://buymeacoffee.com/jeafriday">
    <img src="https://img.buymeacoffee.com/button-api/?text=Support me&emoji=☕&slug=jeafriday&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" alt="Support me" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/JeaFrid">
    <img src="https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub" />
  </a>
  <a href="https://pub.dev/publishers/jeafriday.com/packages">
    <img src="https://img.shields.io/badge/Pub.dev-0175C2?style=for-the-badge&logo=dart&logoColor=white" alt="Pub.dev" />
  </a>
  <a href="https://www.linkedin.com/in/jeafriday/">
    <img src="https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn" />
  </a>
  <a href="https://t.me/jeafrid">
    <img src="https://img.shields.io/badge/Telegram-26A8EA?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram" />
  </a>
</p>

Zeytin is an autonomous server solution backed by the power of the Dart language, completely eliminating external database dependencies. In traditional backend architectures, the server and database operate as separate layers, leading to network latency. Zeytin breaks down these barriers by embedding the database engine directly into the server's memory and processing threads. This client package, which you include in your Node.js or TypeScript project, acts as the bridge that enables encrypted and secure communication with this powerful engine on the server.

### What Happens in the Background?

Zeytin does not behave like a standard REST API. A custom disk-based NoSQL engine we call **Truck** runs on the server side. When you send data via the client, this data is not written to the disk as JSON, but in a machine language format compressed with a special **Binary Encoder**.

The system's most striking feature is its isolation architecture. Every user account has its own isolated thread and memory space on the server. This ensures that a very heavy data operation performed by person A never affects the application performance for person B. Thanks to **Persistent Index** maps held in RAM, data is read in milliseconds through direct coordinate targeting without scanning the disk.

### Why Should You Prefer Zeytin?

When you start developing with this package, you gain the following advantages over classic methods:

- **Total Independence:** You do not need to install or manage external services like MongoDB, PostgreSQL, or Redis for your project. Zeytin is sufficient on its own.
- **End-to-End Encryption:** The client library encrypts data using the AES-CBC standard with keys derived from the user's password before sending it to the server. Even the server administrator cannot see the content of the data without knowing the user password.
- **All-in-One Solution:** It comes ready with not just data storage, but complex modules your application needs, such as Chat, Social Media, E-Commerce, and Live Calls. You don't have to reinvent the wheel.
- **Real-Time Communication:** Every change in the database can be listened to instantly via WebSocket. You can make your application live without any extra setup.

# 2. Installation and Getting Started

Please prepare the server first, or try an existing one: [Zeytin Official Github](https://github.com/JeaFrid/Zeytin)

### Adding the Package

Run the following command in your project directory to install the package:

```bash
npm install zeytin
```

### Initializing the Zeytin Client

Once installation is complete, it is time to shake hands with the server. The Zeytin client should be managed via a single instance throughout the application.

Integrate the following code into your application's entry point:

```typescript
import { ZeytinClient } from "zeytin";

const zeytin = new ZeytinClient();

await zeytin.init({
  host: "https://api.your-server.com",
  email: "user@mail.com",
  password: "strong_password",
});
```

### What Happened in the Background?

When you called the `init` function, a quite complex process operated in the background:

1. **Server Check:** The client sent a ping to the Zeytin server at the host address you provided and checked if the server was up.
2. **Identity and Truck Management:** The entered email and password information were transmitted to the server. The server checked if there was a Truck, meaning a user database file, matching this information. If the account existed, the server returned the Truck ID information belonging to that account. If the account did not exist, the server physically created a new isolated Truck file on the disk for you, stored your password by hashing it, and created your new identity.
3. **Token Automation:** After a successful login, the server gave the client a temporary access key called a Token. `ZeytinClient` tracks the duration of this key internally and automatically talks to the server to renew the key just before it expires. You do not need to perform any additional session management.

# 3. Core and Authentication

The first step of working with Zeytin is to initialize the client and open a secure session. This section explains how connecting to the server, account creation, logging in, and token management work.

### Initializing the Client

At the starting point of your application, you need to initialize the `ZeytinClient` class. This process performs the initial handshake with the server and checks the session status.

```typescript
import { ZeytinClient } from "zeytin";

const zeytin = new ZeytinClient();

await zeytin.init({
  host: "https://api.example.com", // Your server address
  email: "email@example.com",
  password: "strong_password",
});
```

When the `init` function is called, the client follows these steps:

1. It attempts to connect to the server at the given `host` address.
2. If an account exists with the specified email and password, it logs in and receives a `token`.
3. If no account exists, it automatically creates a new `Truck` (user database) and starts the session.
4. It starts a background timer to ensure the token is automatically renewed before it expires.

### Token Management

Zeytin uses short-lived tokens (default is 2 minutes) to increase security. `ZeytinClient` manages these tokens on your behalf. After the `init` function is called, the client periodically sends requests to the server to renew the token. This way, your session does not drop even during long-term usage.

If you wish to access the token:

```typescript
const currentToken = zeytin.token;
```

If the token has expired or is invalid, the `getToken()` method automatically requests a new token.

# 4. Basic Database Operations

Data traffic between the Zeytin client and the server is conducted over fully encrypted packets, unlike classic methods. Although you might think you are sending a simple JavaScript object, in the background, this data is encrypted with the user's private key and transmitted to the server in that form. The server never decrypts this data; it only stores it in binary format. This ensures your data is completely secure both on the disk and on the network.

Our database structure consists of three basic components. At the top is the user's database file called **Truck**, inside it are categories called **Box** structures, and **Tag** keys which are the identity of each piece of data.

### Adding and Updating Data

In the Zeytin system, addition and update operations are managed by a single function. If there is no data at the specified box and tag address, it is created; if it exists, it is overwritten.

```typescript
const response = await zeytin.addData({
  box: "settings",
  tag: "theme_preference",
  value: {
    darkMode: true,
    fontSize: 14,
    lastUpdate: new Date().toISOString(),
  },
});

if (response.isSuccess) {
  console.log("Data was securely written to the disk.");
}
```

### Reading Data

When you want to read data, the server sends you the encrypted packet. The client library instantly decrypts this packet and presents it to you as a meaningful JavaScript object.

```typescript
const response = await zeytin.getData({
  box: "settings",
  tag: "theme_preference",
});

if (response.data != null) {
  const settings = response.data;
  console.log("Dark Mode:", settings["darkMode"]);
}
```

### Deleting Data

To permanently remove a piece of data from the server, it is sufficient to provide the box name and its tag.

```typescript
await zeytin.deleteData({
  box: "settings",
  tag: "theme_preference",
});
```

### Batch Operations

Sometimes in your application, you may need to write hundreds of pieces of data at the same time. In this case, instead of going to the server separately for each piece of data, you should use the batch operation method. This method collects the data into a single encrypted packet and transmits it to the server in one go. This process reduces network traffic and significantly increases performance.

```typescript
const batchData: Record<string, Record<string, unknown>> = {
  product_1: { name: "Laptop", price: 15000 },
  product_2: { name: "Mouse", price: 500 },
  product_3: { name: "Keyboard", price: 750 },
};

await zeytin.addBatch({
  box: "products",
  entries: batchData,
});
```

### Live Data Monitoring

One of the most powerful features of the Zeytin package is its ability to listen to the database live. Thanks to WebSocket technology, when a change occurs in a box on the server, the server instantly notifies all subscribed clients of this change. You can use the `watchBox` async generator to process these events in real time.

```typescript
for await (const event of zeytin.watchBox({ box: "messages" })) {
  // Event types are: PUT, UPDATE, DELETE
  console.log("New event:", event["op"], "- Tag:", event["tag"]);
  console.log("Data:", event["data"]);
}
```

### Search and Filtering

To search within large data sets, you can use the special filtering engine running on the server side. This operation takes place in the server memory without pulling the data to the client.

**Prefix Search:** Checks if a text field starts with a specific group of letters.

```typescript
const results = await zeytin.search({
  box: "users",
  field: "name",
  prefix: "Jo", // Returns names like John, Jonathan
});
```

**Exact Match:** Returns records where a field's value matches exactly.

```typescript
const results = await zeytin.filter({
  box: "products",
  field: "category",
  value: "electronics",
});
```

# 5. Live Call

Zeytin offers built-in support for live call room management through the `joinLiveCall`, `watchLiveCall`, and `checkLiveCall` methods. All authentication and room management processes pass through Zeytin's own secure tunnel.

When you send a request to join a room, the Zeytin client first goes to the main server and asks for encrypted permission. The server checks the user's authority, generates a valid digital key for that moment, and delivers it to the client.

### Joining a Room

```typescript
const response = await zeytin.joinLiveCall({
  roomName: "software-team-meeting",
  userUID: "user_uid",
});

if (response.isSuccess) {
  console.log("Secure connection to the room established.");
  console.log(response.data); // Contains LiveKit token and room info
}
```

### Watching Room Activity

You can watch the live activity status of a call room using the `watchLiveCall` async generator. It emits a boolean value each time the room's active state changes.

```typescript
for await (const isActive of zeytin.watchLiveCall({
  roomName: "software-team-meeting",
})) {
  if (isActive) {
    console.log("Room is active, participants are connected.");
  } else {
    console.log("Room is empty.");
  }
}
```

### Checking Room Status

To query the current status of a room without subscribing to the stream:

```typescript
const status = await zeytin.checkLiveCall({
  roomName: "software-team-meeting",
});

if (status.isSuccess) {
  console.log("Room status:", status.data);
}
```

# 6. File Storage

Zeytin includes a built-in file storage engine. You can upload files directly from the server or from an in-memory buffer, and retrieve their public URLs through the client.

### Uploading a File

You can upload a file either by providing a file path on disk or by passing raw bytes as a `Buffer`.

```typescript
// Upload from disk
const response = await zeytin.uploadFile("/path/to/file.png", "avatar.png");

// Upload from buffer
const buffer = Buffer.from(imageData);
const response = await zeytin.uploadFile("", "avatar.png", buffer);

if (response.isSuccess) {
  console.log("File uploaded successfully.");
}
```

### Getting a File URL

After uploading, you can retrieve the public URL of any file using its ID.

```typescript
const url = zeytin.getFileUrl({ fileId: "file_id_here" });
console.log("File URL:", url);
```

# 7. Utility Classes

### ZeytinResponse

All methods in `ZeytinClient` return a `ZeytinResponse` object. This provides a consistent interface for handling success and error states.

```typescript
import { ZeytinResponse } from "zeytin";

const response = await zeytin.getData({ box: "settings", tag: "theme" });

console.log(response.isSuccess); // boolean
console.log(response.message); // string
console.log(response.data); // Record<string, unknown> | undefined
console.log(response.error); // string | undefined
```

### ZeytinTokener

The `ZeytinTokener` class handles AES-256-CBC encryption and decryption. You can use it independently if you need to encrypt data outside of the client.

```typescript
import { ZeytinTokener } from "zeytin";

const tokener = new ZeytinTokener("my-secret-passphrase");

// Encrypt and decrypt a string
const encrypted = tokener.encryptString("hello world");
const decrypted = tokener.decryptString(encrypted);

// Encrypt and decrypt an object
const encryptedMap = tokener.encryptMap({ name: "John", age: 30 });
const decryptedMap = tokener.decryptMap(encryptedMap);
```

### ZeytinPrint

`ZeytinPrint` is a simple colored console logger used internally by the client. It only outputs when `NODE_ENV` is not set to `production`.

```typescript
import { ZeytinPrint } from "zeytin";

ZeytinPrint.success("Operation completed.");
ZeytinPrint.error("Something went wrong.");
ZeytinPrint.warning("Proceed with caution.");
```
