import pandas as pd

df = pd.read_excel("input.xlsx")
df.to_csv("output.csv", index=False)
