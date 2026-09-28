# Licensing, attribution, and data use

## Application code

Original application code and documentation are licensed under the MIT License in [`../LICENSE`](../LICENSE). No community benchmark adapter code, proprietary design, or third-party assets were copied into this implementation.

## Benchmark facts and third-party material

The project identifies source publishers, URLs, evidence locators, retrieval dates/hashes, and source-review/replication states in `data/sources/registry.json` and per observation. It displays an explicit unofficial/non-affiliation notice.

The Datacurve v1.1 endpoint is publicly accessible, but research did not find a feed-specific redistribution license. Datacurve's separate benchmark repository has an Apache-2.0 license; this project does not assume that it applies to the hosted JSON. Following the implementation brief, the checked-in dataset contains attributed normalized result facts and provenance only, not the complete feed response, source page, PDF, benchmark tasks, solutions, trajectories, or private logs. Do not add those source documents to `data/approved`, `data/snapshots`, or the Pages artifact without separate permission.

Publisher names/model identifiers remain their respective owners' marks. Factual source claims are attributed and are not endorsements. The OpenAI/Anthropic/Artificial Analysis source observations retain their distinct evaluations and missing-field caveats. The community `llm-benchmark` repository is MIT-licensed, but its code/data have not been reused as the approved results dataset.

The data-use note describes project behavior; it is not a representation that third-party result facts are licensed for every downstream use. Downstream users should consult original publishers and applicable terms.
