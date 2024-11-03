# Discord Wikis Environment Guide

## Overview
Since we are doing lots of Python development, we need to make sure that we have a way of managing our libraries such that different packages don't conflict with each other. Anaconda helps with that.

## Steps to download and use Anaconda
1. Download Anaconda from [this link](https://www.anaconda.com/download/success)
2. Go to Terminal and navigate to the Discord-Wiki director (which is where the .yml file should be)
3. Create environment from .yml file:
    ```bash
    conda env create -f discord-wikis.yml
    ```
4. Activate conda environment:
    ```bash
    conda activate discord-wikis
    ```
5. Go to Finder, open Applications folder, and double click on the Anaconda-Navigator. At the top, it will say "**All Applications** on **base**". Change the **base** to **discord-wikis** and launch VSCode.

Now when you run the file, it will run with the packages in the environment.

## Updating Anaconda
1. You can download new packages with:
    ```bash
    conda install <package-name>
    ```
2. When you're done changing the environment, you update the file with:
    ```bash
    conda env export > discord-wikis.yml
    ```
3. To go back to your computer's base environment:
    ```bash
    conda deactivate
    ```