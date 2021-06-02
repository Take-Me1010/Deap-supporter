# Change Log

All notable changes to the "deap-supporter" extension will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)

## [2.0.0] - 2021-06-02

### changed

- All of the commands exiting before have been abolished.
  - Because there may be no need to reload the current document.
    - Moreover, it's a pain in the ass to load or reload.
  - Instead, add the command to activate this extension.

### added

- added the command to activate this extension
  - once you activate, there is no need to load the current document.
  - automatically load and add your custom classes or aliases!


## [1.0.1] - 2021-03-19

### Fixed

This extension could not parse the string for "" before.

```python
# OK
creator.create('Individual', list, fitness=creator.FitnessMax)
# Error
creator.create("Individual", list, fitness=creator.FitnessMax)
```

Now, maybe this extension can parse both styles.


## [1.0.0] - 2021-03-07

- Initial release
