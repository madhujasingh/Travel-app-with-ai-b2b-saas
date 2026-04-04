"""
Train a destination recommendation model from CSV datasets.

Usage:
python train_model.py \
  --destinations /path/to/destinations.csv \
  --interactions /path/to/user_interactions.csv \
  --output artifacts/destination_recommender.joblib
"""

import argparse
import json

from models.trained_recommender import TrainedDestinationRecommender


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--destinations", required=True)
    parser.add_argument("--interactions", required=True)
    parser.add_argument("--output", default="artifacts/destination_recommender.joblib")
    args = parser.parse_args()

    metadata = TrainedDestinationRecommender.train(
        destinations_path=args.destinations,
        interactions_path=args.interactions,
        artifact_output_path=args.output,
    )
    print(json.dumps({"status": "ok", "artifact": args.output, "metadata": metadata}, indent=2))


if __name__ == "__main__":
    main()
