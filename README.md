# SPARK - Server Power Automated Remote Kontrol

![SPARK Banner](https://img.shields.io/badge/SPARK-Server%20Power%20Automated%20Remote%20Kontrol-blue?style=for-the-badge&logo=bolt)

SPARK is a smart power-saving proxy for your home server. It acts as a transparent gateway, automatically waking your target server (e.g., a machine running an LLM, a media server, or any other HTTP service) when a request comes in, and putting it to sleep when it's idle.

Save energy without sacrificing convenience. Point your applications at SPARK, and it handles the rest.

---

## 🚀 Features

-   **Transparent HTTP Proxy**: No need to change your client applications. Point them at SPARK's address, and it intelligently wakes and forwards requests to your target server.
-   **Wake-on-LAN & Remote Sleep**: Manually wake and sleep your server from a clean web interface.
-   **Intelligent Idle Shutdown**: Automatically put the server to sleep based on inactivity.
    -   **Request-Based Timer**: Shuts down after a configurable period of no HTTP requests.
    -   **Optional GPU Monitoring**: For ML/LLM servers, you can add GPU utilization as a second condition for the shutdown timer.
-   **Web-Based Dashboard**: Monitor your server's status and configure the idle shutdown behaviour in real-time with an intuitive UI.
-   **Dockerized Deployment**: Simple, container-based setup using Docker Compose.

## 🎯 Use Cases

-   **LLM & AI Servers**: Power down GPU-intensive machines (running Ollama, Llama.cpp, etc.) when not in use, and wake them on demand.
-   **Development Servers**: Keep your dev server asleep until you make your first API call.
-   **Home Media Servers**: Run your Plex or Jellyfin server only when you're actively using it.
-   **Any On-Demand HTTP Service**: Perfect for any service that doesn't need to be running 24/7.

## 🔧 Installation

SPARK is designed to be deployed as a Docker container, often on a low-power, always-on device like a Raspberry Pi.

### Prerequisites

-   Docker & Docker Compose
-   A target server with Wake-on-LAN enabled in its BIOS/UEFI.
-   Git

### 1. Clone the Repository

```bash
git clone [https://github.com/jmk2000/spark.git](https://github.com/jmk2000/spark.git)
cd spark
```

### 2. Create SSH Keys

SPARK needs SSH access to put your target server to sleep and monitor GPU usage. We will create a dedicated SSH key for this.

```bash
# Create a directory to hold the keys
mkdir -p ./.ssh

# Generate the key pair inside it (press Enter for all prompts)
ssh-keygen -t rsa -b 4096 -f ./.ssh/id_rsa
```

### 3. Configure Your Environment

Copy the example environment file and edit it with your specific details.

```bash
cp .env.example .env
nano .env
```

You will need to fill in the variables, most importantly `TARGET_SERVER_IP`, `TARGET_SERVER_MAC`, and `SSH_USERNAME`.

### 4. Authorize the SSH Key

Copy the contents of the public key we created:

```bash
cat ./.ssh/id_rsa.pub
```

Now, SSH into your **target server** (the one you want to control) and paste that key into the `~/.ssh/authorized_keys` file for the user specified in your `.env` file.

### 5. Configure Target Server Permissions

The user on the target server needs passwordless `sudo` access to run two commands: `systemctl` and `ethtool`.

On the **target server**, run `sudo visudo` and add the following line at the end, replacing `<your-ssh-user>` with the username you set in your `.env` file:

```
<your-ssh-user> ALL=(ALL) NOPASSWD: /usr/bin/systemctl, /usr/sbin/ethtool
```

### 6. Build and Deploy SPARK

Now you can build and run the Docker container.

```bash
docker-compose up -d --build
```

Access the SPARK web interface by navigating to `http://<IP-of-your-SPARK-host>:3000`.

## 💡 Usage

### Transparent Proxy

To use the proxy, simply point your client applications to the address of the machine running SPARK. For example, if you were using `curl` to talk to Ollama, you would change:

-   **Before:** `curl http://<TARGET_SERVER_IP>:<TARGET_SERVER_PORT>/api/generate ...`
-   **After:** `curl http://<SPARK_HOST_IP>:3000/api/generate ...`

SPARK will intercept the request and handle everything else automatically.

### Idle Shutdown Configuration

Use the web dashboard to configure the idle shutdown behavior:
1.  **Enable Idle Shutdown**: The master switch for the feature.
2.  **Idle Duration**: A slider to set how long to wait after the last HTTP request before sleeping.
3.  **Include GPU Utilization**: An optional checkbox. If checked, the server will also sleep if the GPU has been idle for the duration specified by `AUTO_SLEEP_IDLE_MINUTES` in your `.env` file.

## 🤝 Contributing

Contributions are welcome! Please feel free to fork the repository, make changes, and submit a pull request.
