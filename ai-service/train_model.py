"""
Train a package recommendation model from CSV datasets.

Usage:
python train_model.py \
  --catalog /path/to/app_packages.csv \
  --interactions /path/to/app_package_interactions.csv \
  --output artifacts/destination_recommender.joblib
"""

import argparse
import json

from models.trained_recommender import TrainedDestinationRecommender


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog")
    parser.add_argument("--destinations")
    parser.add_argument("--interactions", required=True)
    parser.add_argument("--output", default="artifacts/destination_recommender.joblib")
    args = parser.parse_args()

    catalog_path = args.catalog or args.destinations
    if not catalog_path:
        parser.error("--catalog is required")

    metadata = TrainedDestinationRecommender.train(
        destinations_path=catalog_path,
        interactions_path=args.interactions,
        artifact_output_path=args.output,
    )
    print(json.dumps({"status": "ok", "artifact": args.output, "metadata": metadata}, indent=2))


if __name__ == "__main__":
    main()
