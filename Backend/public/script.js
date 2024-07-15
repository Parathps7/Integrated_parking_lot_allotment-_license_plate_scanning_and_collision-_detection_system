// Function to allocate parking slot
async function allocateSlot() {
    try {
        const response = await fetch('http://localhost:8080/allocate', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to allocate parking slot');
        }

        const result = await response.json();
        console.log('Allocated parking slot:', result);
        updateUIWithAllocatedSlot(result.lot_id);
    } catch (error) {
        console.error('Error allocating slot:', error);
        document.getElementById('message').textContent = 'Parking lots are full';
    }
}

// Function to update UI with allocated slot
function updateUIWithAllocatedSlot(lotId) {
    const slotElement = document.getElementById(`slot${lotId}`);
    if (slotElement) {
        slotElement.textContent = `Occupied: Lot ${lotId}`;
        slotElement.style.backgroundColor = 'red'; // Example styling for occupied slot
        document.getElementById('message').textContent = `Slot ${lotId} allocated`;
    }
}
