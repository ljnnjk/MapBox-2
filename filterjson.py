import json
import geojson

def filter_geojson(geojson_data):
    """Filters a GeoJSON FeatureCollection to keep only features with Cycle starting with '9'."""
    try:
        #Check if it is valid GeoJSON
        geojson.loads(json.dumps(geojson_data)) #this will raise exception if not valid.
    except geojson.GeoJSONError as e:
        print(f"Error: Invalid GeoJSON data: {e}")
        return None

    features_to_keep = []
    for feature in geojson_data['features']:
        cycle = feature['properties'].get('Cycle') # Use get() to handle missing keys gracefully.
        if cycle and cycle.startswith('9'):
            features_to_keep.append(feature)

    filtered_geojson = {"type": "FeatureCollection", "features": features_to_keep} #re-create the FeatureCollection
    return filtered_geojson

# Load your JSON data (replace 'your_geojson_file.json' with your file path)
try:
    with open('Final.json', 'r') as f:
        geojson_data = json.load(f)
except FileNotFoundError:
    print("Error: JSON file not found.")
    exit()
except json.JSONDecodeError:
  print("Error: Invalid JSON format in the file.")
  exit()


# Filter the data.
filtered_data = filter_geojson(geojson_data)

if filtered_data:  # Check if filtering was successful.
    # Save the filtered JSON data (replace 'filtered_geojson.json' with your desired output file path).
    try:
        with open('filtered_final.json', 'w') as f:
            json.dump(filtered_data, f, indent=2)  # indent for readability
        print("Filtered JSON data saved to filtered_geojson.json")
    except Exception as e:
        print(f"Error saving filtered JSON: {e}")