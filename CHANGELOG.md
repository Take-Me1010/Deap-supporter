# Change Log

All notable changes to the "deap-supporter-ts" extension will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)

## [1.0.1] - 2021-03-19

### Fixed

Extension could not parse the string for "" before.

```python
# OK
creator.create('Individual', list, fitness=creator.FitnessMax)
# Error
creator.create("Individual", list, fitness=creator.FitnessMax)
```

Now, maybe this extension can parse both styles.


## [1.0.0] - 2021-03-07

- Initial release
