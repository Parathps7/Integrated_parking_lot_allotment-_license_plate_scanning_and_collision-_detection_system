import cv2
import numpy as np
import cvzone
import pickle
import os

# Function to generate a filename for polylines based on video filename
def get_polyline_filename(video_filename):
    base_name = os.path.splitext(os.path.basename(video_filename))[0]
    return f"{base_name}_polylines.pkl"

# Load video
video_filename = 'easy.mp4'  # Change this to the video you want to process
cap = cv2.VideoCapture(video_filename)

drawing = False
area_names = []
polylines = []

# Load existing polylines if available
polyline_filename = get_polyline_filename(video_filename)
if os.path.exists(polyline_filename):
    with open(polyline_filename, "rb") as f:
        data = pickle.load(f)
        polylines, area_names = data['polylines'], data['area_names']

points = []
current_name = " "

def draw(event, x, y, flags, param):
    global points, drawing
    if event == cv2.EVENT_LBUTTONDOWN:
        drawing = True
        points = [(x, y)]
    elif event == cv2.EVENT_MOUSEMOVE and drawing:
        points.append((x, y))
    elif event == cv2.EVENT_LBUTTONUP:
        drawing = False
        current_name = input('Enter area name: ')
        if current_name:
            area_names.append(current_name)
        polylines.append(np.array(points, np.int32))

while True:
    ret, frame = cap.read()
    if not ret:
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        continue
    frame = cv2.resize(frame, (1020, 500))
    for i, polyline in enumerate(polylines):
        cv2.polylines(frame, [polyline], True, (0, 0, 255), 2)
        cvzone.putTextRect(frame, f'{area_names[i]}', tuple(polyline[0]), 1, 1)
    cv2.imshow('FRAME', frame)
    cv2.setMouseCallback('FRAME', draw)

    key = cv2.waitKey(100) & 0xFF
    if key == ord('s'):
        with open(polyline_filename, "wb") as f:
            data = {'polylines': polylines, 'area_names': area_names}
            pickle.dump(data, f)
        print(f"Polylines saved to {polyline_filename}")
    elif key == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
