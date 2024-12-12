import os
import subprocess
import json
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import filter_csv
import shutil
import pandas as pd


def csv_to_json_pandas(csv_file_path, orient='records'):
    """
    Converts a CSV file to a JSON object using pandas.

    :param csv_file_path: Path to the input CSV file.
    :param orient: String indicating the format of the JSON output.
                   'records' is a list of dictionaries.
    :return: JSON object (list of dictionaries) representing the CSV data.
    """
    try:
        # Read the CSV file into a DataFrame
        df = pd.read_csv(csv_file_path, header=None)

        # Convert the DataFrame to a JSON object (list of dictionaries)
        json_data = df.to_dict(orient=orient)

        print(f"Successfully converted {csv_file_path} to JSON object using pandas")
        return json_data

    except Exception as e:
        print(f"Error converting CSV to JSON with pandas: {e}")
        return None


app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # Allow all origins

@app.route('/calculate_route', methods=['POST'])
def calculate_route():
    try:
        data = request.json
        required_params = [
            "start_lat", "start_lon", "goal_lat", "goal_lon", 
            "ship_speed", "ship_height", "ship_dis", "area_front", "ship_reso", 
            "hull_eff", "prop_eff", "engine_eff", "c_sfoc", "shipw"
        ]

        # Validate required parameters
        missing_params = [param for param in required_params if data.get(param) is None]
        if missing_params:
            return jsonify({"error": f"Missing parameters: {', '.join(missing_params)}"}), 400

        # Define filenames
        original_output_files = [
            'path_fuel.csv', 'path_safe.csv', 'path_short.csv'
        ]
        smoothed_output_files = [
            'path_fuel_smoothed.csv', 'path_safe_smoothed.csv', 'path_short_smoothed.csv'
        ]
        additional_output_files = [
            'results.csv'  # Removed 'data_points.csv' as per your request
        ]
        save_folder = r"C:\Users\Admin\Desktop\SamudraPath\SamudraPath\public"

        # Define the output directory containing additional files
        output_directory = "output"  # Adjust this path if 'output' is located elsewhere

        # Specific files to remove before processing (excluding 'data_points.csv')
        files_to_remove = original_output_files + smoothed_output_files + additional_output_files

        # Selectively remove only route-related files
        for filename in files_to_remove:
            file_path = os.path.join(save_folder, filename)
            if os.path.exists(file_path):
                os.remove(file_path)
        
        # Delete existing smoothed path files before copying new ones
        try:
            # Assuming nsga_paths_length determines the number of dynamic routes
            # You can adjust the range as per your requirements
            for i in range(1, 8):  # Replace 8 with nsga_paths_length + 1 if dynamic
                filename = f"path_{i}_smoothed.csv"
                file_path = os.path.join(save_folder, filename)
                if os.path.exists(file_path):
                    os.remove(file_path)
                    app.logger.info(f"Deleted existing file: {file_path}")
        except Exception as e:
            return jsonify({"error": f"Failed to delete existing smoothed path files: {str(e)}"}), 500

        try:
            for file in additional_output_files:
                if os.path.exists(file):
                    os.remove(file)
        except Exception as e:
            return jsonify({"error": f"Failed to remove additional output files: {str(e)}"}), 500

        # Ensure the save folder exists
        os.makedirs(save_folder, exist_ok=True)

        # Run the main algorithm
        from algorithm import main as algorithm_main
        try:
            results = algorithm_main(
                start_lat=data['start_lat'],
                start_lon=data['start_lon'],
                goal_lat=data['goal_lat'],
                goal_lon=data['goal_lon'],
                ship_speed=data['ship_speed'],
                ship_dis=data['ship_dis'],
                area_front=data['area_front'],
                ship_height=data['ship_height'],
                ship_reso=data['ship_reso'],
                hull_eff=data['hull_eff'],
                prop_eff=data['prop_eff'],
                engine_eff=data['engine_eff'],
                c_sfoc=data['c_sfoc']
            )
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

        # Run the NSGA algorithm
        from nsga import main as nsga_main
        try:
            nsga_main(
                start_lat=data["start_lat"],
                start_lon=data["start_lon"],
                goal_lat=data["goal_lat"],
                goal_lon=data["goal_lon"],
                shipw=data["shipw"]
            )
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

        # Verify original output files are generated
        if not all(os.path.exists(file) for file in original_output_files):
            return jsonify({"error": "Route calculation failed. One or more output files not found."}), 500

        # Smooth static routes using filter_csv module
        try:
            # Process and save route for fuel
            smoothed_route_fuel = filter_csv.process_route("path_fuel.csv", epsilon=0.001, window_size=3)
            filter_csv.save_to_csv(smoothed_route_fuel, "path_fuel_smoothed.csv")

            # Process and save route for safe
            smoothed_route_safe = filter_csv.process_route("path_safe.csv", epsilon=0.001, window_size=3)
            filter_csv.save_to_csv(smoothed_route_safe, "path_safe_smoothed.csv")

            # Process and save route for short
            smoothed_route_short = filter_csv.process_route("path_short.csv", epsilon=0.001, window_size=3)
            filter_csv.save_to_csv(smoothed_route_short, "path_short_smoothed.csv")

            # Copy smoothed static files to the save folder
            for file in smoothed_output_files:
                if os.path.exists(file):
                    dest_path = os.path.join(save_folder, os.path.basename(file))
                    shutil.copy2(file, dest_path)

        except Exception as e:
            return jsonify({"error": f"Route smoothing failed: {str(e)}"}), 500

        # Copy additional output files to the save folder and delete after copying
        try:
            for file in additional_output_files:
                if os.path.exists(file):
                    dest_path = os.path.join(save_folder, os.path.basename(file))
                    shutil.copy2(file, dest_path)
        except Exception as e:
            return jsonify({"error": f"Failed to copy additional output files: {str(e)}"}), 500

        # Copy all files from the 'output' directory to the save folder and delete after copying
        try:
            if os.path.isdir(output_directory):
                for filename in os.listdir(output_directory):
                    source_path = os.path.join(output_directory, filename)
                    if os.path.isfile(source_path):
                        dest_path = os.path.join(save_folder, filename)
                        shutil.copy2(source_path, dest_path)
            else:
                app.logger.warning(f"The output directory '{output_directory}' does not exist.")
        except Exception as e:
            return jsonify({"error": f"Failed to copy files from output directory: {str(e)}"}), 500

        temp_res_json = csv_to_json_pandas ("./results.csv")

        try:
            if os.path.isdir(output_directory):
                shutil.rmtree(output_directory)
                os.makedirs(output_directory, exist_ok=True)  # Recreate the empty 'output' directory
        except Exception as e:
            return jsonify({"error": f"Failed to clean up output directory: {str(e)}"}), 500

        return jsonify(results, temp_res_json), 200
    except Exception as e:
            return jsonify({"error": f"Failed to copy files from output directory: {str(e)}"}), 500


    

@app.route('/new_positon', methods=['POST'])
def new_position():
    try:
        data = request.json

        required_params = [
            "start_lat", "start_lon", "goal_lat", "goal_lon", 
            "shipw", "flag"
        ]

        # Validate required parameters
        missing_params = [param for param in required_params if data.get(param) is None]
        if missing_params:
            return jsonify({"error": f"Missing parameters: {', '.join(missing_params)}"}), 400


        # Call the main calculation function and get the new position
         # Ensure the main function is in calculate_position.py

        original_output_files = [
            
        ]
        save_folder = "C:/Users/Admin/Desktop/SamudraPath/SamudraPath/public"
        
        # Specific files to remove
        files_to_remove = [
            
        ]

        # Selectively remove only route-related files
        for filename in files_to_remove:
            file_path = os.path.join(save_folder, filename)
            if os.path.exists(file_path):
                os.remove(file_path)

        # Ensure the save folder exists
        os.makedirs(save_folder, exist_ok=True)

        from nsga import main
        try:
            main(
                start_lat=data["start_lat"],
                start_lon=data["start_lon"],
                goal_lat=data["goal_lat"],
                goal_lon=data["goal_lon"],
                shipw=data["shipw"],
                flag=data['flag']
            )
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        

        if not all(os.path.exists(file) for file in original_output_files):
            return jsonify({"error": "Route smoothing failed. Smoothed files not created."}), 500

        # Copy all output files to the specified folder
        for file in original_output_files:
            if os.path.exists(file):
                dest_path = os.path.join(save_folder, os.path.basename(file))
                shutil.copy2(file, dest_path)

        # Return the new position to the frontend
        return jsonify({
            "message": "Route position calculation completed successfully"
        }), 200

    except Exception as e:
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500


if __name__ == '__main__':
    app.run(debug=True)