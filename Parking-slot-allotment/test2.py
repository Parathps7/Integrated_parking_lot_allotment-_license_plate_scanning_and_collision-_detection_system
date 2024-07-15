import cv2
import numpy as np
import cvzone
import pickle
import os
import pandas as pd
from ultralytics import YOLO
import websocket
import json



def on_message(ws, message):
    print(f"Received: {message}")

def on_error(ws, error):
    print(f"Error: {error}")

def on_close(ws, close_status_code, close_msg):
    print("Connection closed")

def on_open(ws):
    print("WebSocket connection opened")

# Function to generate a filename for polylines based on video filename
def get_polyline_filename(video_filename):
    base_name = os.path.splitext(os.path.basename(video_filename))[0]
    return f"{base_name}_polylines.pkl"

def process_parking_lot(lot_id, video_filename, polylines, area_names):
    ws = websocket.WebSocketApp("ws://localhost:8080",
                                on_open=on_open,
                                on_message=on_message,
                                on_error=on_error,
                                on_close=on_close)
    import _thread
    _thread.start_new_thread(ws.run_forever, ())

    model = YOLO('yolov8s.pt')
    cap = cv2.VideoCapture(video_filename)

    count = 0
    last_free_space = -1
    last_car_count = -1

    while True:
        ret, frame = cap.read()
        if not ret:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue

        count += 1
        if count % 3 != 0:
            continue

        frame = cv2.resize(frame, (1020, 500))
        frame_copy = frame.copy()
        results = model.predict(frame)
        a = results[0].boxes.data
        px = pd.DataFrame(a).astype("float")
        list1 = []

        for index, row in px.iterrows():
            x1 = int(row[0])
            y1 = int(row[1])
            x2 = int(row[2])
            y2 = int(row[3])
            d = int(row[5])

            c = class_list[d]
            cx = int(x1 + x2) // 2
            cy = int(y1 + y2) // 2
            if 'car' in c:
                list1.append([cx, cy])

        counter1 = []
        list2 = []
        for i, polyline in enumerate(polylines):
            list2.append(i)
            cv2.polylines(frame, [polyline], True, (0, 255, 0), 2)
            cvzone.putTextRect(frame, f'{area_names[i]}', tuple(polyline[0]), 1, 1)
            for i1 in list1:
                cx1 = i1[0]
                cy1 = i1[1]
                result = cv2.pointPolygonTest(polyline, ((cx1, cy1)), False)
                if result >= 0:
                    cv2.circle(frame, (cx1, cy1), 5, (255, 0, 0), -1)
                    cv2.polylines(frame, [polyline], True, (0, 0, 255), 2)
                    counter1.append(cx1)

        car_count = len(counter1)
        free_space = len(list2) - car_count
        cvzone.putTextRect(frame, f'LOT {lot_id} - FREE SPACES: {free_space}/{len(list2)}', (50, 60 + lot_id * 30), 2, 2)

        if free_space != last_free_space or car_count != last_car_count:
            last_free_space = free_space
            last_car_count = car_count
            parking_data = {
                "type": "parking_update",
                "lot_id": lot_id,
                "free_space": free_space,
                "car_count": car_count,
                "latitude" : 41.40338,
                "longitude" : 2.17403
            }
            ws.send(json.dumps(parking_data))

        try:
            cv2.imshow(f'FRAME - LOT {lot_id}', frame)
        except cv2.error as e:
            print(f"Error displaying frame for lot {lot_id}: {e}")
            break

        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()
    ws.close()

# Load parking lot data for multiple lots
with open("coco.txt", "r") as my_file:
    data = my_file.read()
    class_list = data.split("\n")

# List of video files for different parking lots
video_paths = ['easy1.mp4', 'easy2.mp4']  # Add paths to your parking lot videos

# Process each video sequentially
for lot_id, video_filename in enumerate(video_paths):
    polyline_filename = get_polyline_filename(video_filename)
    if os.path.exists(polyline_filename):
        with open(polyline_filename, "rb") as f:
            data = pickle.load(f)
            polylines, area_names = data['polylines'], data['area_names']
    else:
        polylines, area_names = [], []
# lot_id from [1,inf]
    process_parking_lot(2, video_filename, polylines, area_names)
