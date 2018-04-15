# Azure IoT Hub Device node for Node-Red

This package breaks down the features of the Azure IoT Hub device SDK into small, manageable nodes for Node-Red.

The nodes included in this package are:
- **iot-device-config**: A configuration node that provides credentials and a common device client for all feature nodes
- **iot-device-send-telemetry**: An output node that sends telemetry messages to an Azure IoT hub as the configured device.
- **iot-device-receive-commands**: An input node that receives commands sent to the configured device from an Azure IoT hub.
- **iot-device-method-request**: An input node that receive method calls for specific direct methods. This must be paired with an **iot-device-method-response** or the method call will time out.
- **iot-device-method-response**: An output node that sends a method response (must be paired with an **iot-device-method-request** to receive method requests)
